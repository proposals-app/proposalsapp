use crate::{
    db_handler::{get_or_create_unknown_user, get_post_like_count, upsert_post, DB},
    discourse_api::DiscourseApi,
    indexers::{likes::LikesIndexer, users::UserIndexer},
    models::posts::{Post, PostResponse},
};
use anyhow::{Context, Result};
use futures::stream::{self, StreamExt};
use proposalsapp_db::models::discourse_post;
use reqwest::Client;
use sea_orm::{
    prelude::{Expr, Uuid},
    ColumnTrait, Condition, EntityTrait, QueryFilter,
};
use std::{collections::HashSet, sync::Arc};
use tokio::task;
use tracing::{error, info, instrument, warn};

pub struct PostIndexer {
    discourse_api: Arc<DiscourseApi>,
    http_client: Arc<Client>, // Reused http_client
}

impl PostIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>) -> Self {
        Self {
            discourse_api,
            http_client,
        }
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, topic_id = topic_id))]
    pub async fn update_posts_for_topic(&self, dao_discourse_id: Uuid, topic_id: i32, priority: bool) -> Result<()> {
        info!("Starting to update posts for topic");

        // Fetch existing posts for the topic from the database
        let existing_posts = discourse_post::Entity::find()
            .filter(
                Condition::all()
                    .add(discourse_post::Column::TopicId.eq(topic_id))
                    .add(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch existing posts")?;

        let existing_post_ids: HashSet<i32> = existing_posts.iter().map(|post| post.external_id).collect();

        let mut page = 0;
        let mut total_posts_count: i32 = 0;
        let mut total_unique_posts_fetched: i32 = 0;
        let mut seen_post_ids: HashSet<i32> = HashSet::new();

        loop {
            let url = format!("/t/{}.json?include_raw=true&page={}", topic_id, page);
            info!(url, "Fetching posts");
            match self
                .discourse_api
                .queue::<PostResponse>(&url, priority)
                .await
            {
                Ok(response) => {
                    if total_posts_count == 0 {
                        total_posts_count = response.posts_count;
                    }

                    let posts = response.post_stream.posts;
                    let num_posts = posts.len() as i32;
                    let is_empty = posts.is_empty();

                    let new_unique_posts: Vec<&Post> = posts
                        .iter()
                        .filter(|post| seen_post_ids.insert(post.id))
                        .collect();

                    let num_new_unique_posts = new_unique_posts.len() as i32;
                    total_unique_posts_fetched += num_new_unique_posts;

                    if !is_empty {
                        stream::iter(posts)
                            .map(|post| {
                                let api_handler = Arc::clone(&self.discourse_api);
                                let http_client = Arc::clone(&self.http_client); // Clone the Arc
                                task::spawn(async move { Self::process_post(post, dao_discourse_id, api_handler, http_client, priority).await })
                            })
                            .buffer_unordered(10)
                            .for_each(|_| async {})
                            .await;
                    }
                    info!(
                        topic_id,
                        page = page + 1,
                        num_new_unique_posts,
                        num_posts,
                        total_unique_posts_fetched,
                        total_posts_count,
                        url,
                        "Fetched and processed posts for topic"
                    );

                    if total_unique_posts_fetched >= total_posts_count {
                        info!(
                            topic_id,
                            "Finished fetching all unique posts for topic. Stopping."
                        );
                        break;
                    }

                    page += 1;
                }
                Err(e) => {
                    if e.to_string().contains("404") {
                        info!(
                            topic_id,
                            page, "Reached end of pages (404 error). Stopping."
                        );
                        break;
                    } else {
                        error!(
                            error = ?e,
                            topic_id,
                            page,
                            "Failed to fetch posts for topic"
                        );
                        return Err(e).context("Failed to fetch posts for topic")?;
                    }
                }
            }
        }

        // Mark posts that are in the database but not in the API response as deleted
        let posts_to_mark_deleted: Vec<i32> = existing_post_ids
            .difference(&seen_post_ids)
            .cloned()
            .collect();

        if !posts_to_mark_deleted.is_empty() {
            info!(
                topic_id,
                num_posts_to_mark_deleted = posts_to_mark_deleted.len(),
                "Marking posts as deleted"
            );

            let update_result = discourse_post::Entity::update_many()
                .col_expr(discourse_post::Column::Deleted, Expr::value(true))
                .filter(
                    Condition::all()
                        .add(discourse_post::Column::ExternalId.is_in(posts_to_mark_deleted))
                        .add(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
                        .add(discourse_post::Column::TopicId.eq(topic_id)),
                )
                .exec(DB.get().unwrap())
                .await?;

            info!(
                topic_id,
                num_posts_marked_deleted = update_result.rows_affected,
                "Marked posts as deleted"
            );
        }

        info!(
            topic_id,
            total_unique_posts_fetched, total_posts_count, "Finished updating posts for topic"
        );
        Ok(())
    }

    #[instrument(skip( discourse_api, http_client), fields(post_id = %post.id, username = %post.username))]
    async fn process_post(post: Post, dao_discourse_id: Uuid, discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>, priority: bool) {
        // Before upserting the post, ensure the user exists.
        let user_fetcher = UserIndexer::new(Arc::clone(&discourse_api), Arc::clone(&http_client)); // Pass shared http_client
        let user_exists = match user_fetcher
            .fetch_user_by_username(&post.username, dao_discourse_id, priority)
            .await
        {
            Ok(_) => true,
            Err(_) => {
                warn!(
                    username = post.username,
                    "Failed to fetch user, using unknown user"
                );
                false
            }
        };

        let post_to_upsert = if user_exists {
            post.clone()
        } else {
            match get_or_create_unknown_user(dao_discourse_id).await {
                Ok(unknown_user) => {
                    // Create a new post with the unknown user
                    let mut unknown_post = post.clone();
                    unknown_post.user_id = unknown_user.id;
                    unknown_post.username = unknown_user.username.clone();
                    unknown_post
                }
                Err(e) => {
                    error!(
                        error = ?e,
                        post_id = post.id,
                        "Failed to get or create unknown user"
                    );
                    return;
                }
            }
        };

        match upsert_post(&post_to_upsert, dao_discourse_id).await {
            Ok(_) => {
                let current_likes_count = match get_post_like_count(post.id, dao_discourse_id).await {
                    Ok(count) => count,
                    Err(e) => {
                        error!(
                            error = ?e,
                            post_id = post.id,
                            "Failed to fetch current like count"
                        );
                        return;
                    }
                };

                if let Some(actions_summary_item) = post.actions_summary.iter().find(|item| item.id == 2) {
                    if actions_summary_item.count > current_likes_count {
                        info!(
                            post_id = post.id,
                            current_likes_count,
                            count = actions_summary_item.count,
                            "Fetching new likes for post"
                        );

                        let likes_indexer = LikesIndexer::new(Arc::clone(&discourse_api));
                        if let Err(e) = likes_indexer
                            .fetch_and_store_likes(dao_discourse_id, post.id, priority)
                            .await
                        {
                            error!(
                                error = ?e,
                                post_id = post.id,
                                "Failed to fetch and store likes"
                            );
                        }
                    } else {
                        info!(
                            post_id = post.id,
                            current_likes_count, "No new likes to fetch"
                        );
                    }
                }

                info!(post_id = post.id, "Successfully upserted post");
            }
            Err(e) => {
                error!(
                    error = ?e,
                    post_id = post.id,
                    "Failed to upsert post"
                );
            }
        }
    }
}
