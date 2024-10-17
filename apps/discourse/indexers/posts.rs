use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::indexers::users::UserIndexer;
use crate::models::posts::{Post, PostResponse};
use anyhow::Result;
use futures::stream::{self, StreamExt};
use sea_orm::prelude::Uuid;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::task;
use tracing::{error, info, instrument, warn};

pub struct PostIndexer {
    api_handler: Arc<ApiHandler>,
}

impl PostIndexer {
    pub fn new(api_handler: Arc<ApiHandler>) -> Self {
        Self { api_handler }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id, topic_id = topic_id))]
    pub async fn update_posts_for_topic(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        topic_id: i32,
    ) -> Result<()> {
        let mut page = 0;
        let mut total_posts_count: i32 = 0;
        let mut total_unique_posts_fetched: i32 = 0;
        let mut seen_post_ids: HashSet<i32> = HashSet::new();

        loop {
            let url = format!("/t/{}.json?page={}", topic_id, page);
            match self.api_handler.fetch::<PostResponse>(&url, true).await {
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
                                let db_handler = Arc::clone(&db_handler);
                                let api_handler = Arc::clone(&self.api_handler);
                                task::spawn(async move {
                                    Self::process_post(
                                        post,
                                        db_handler,
                                        dao_discourse_id,
                                        api_handler,
                                    )
                                    .await
                                })
                            })
                            .buffer_unordered(10)
                            .for_each(|_| async {})
                            .await;
                    }
                    info!(
                        topic_id = topic_id,
                        page = page + 1,
                        num_new_unique_posts = num_new_unique_posts,
                        num_posts = num_posts,
                        total_unique_posts_fetched = total_unique_posts_fetched,
                        total_posts_count = total_posts_count,
                        url = url,
                        "Fetched and processed posts for topic"
                    );

                    if total_unique_posts_fetched >= total_posts_count {
                        info!(
                            topic_id = topic_id,
                            "Finished fetching all unique posts for topic. Stopping."
                        );
                        break;
                    }

                    page += 1;
                }
                Err(e) => {
                    if e.to_string().contains("404") {
                        info!(
                            topic_id = topic_id,
                            page = page,
                            "Reached end of pages (404 error). Stopping."
                        );
                        break;
                    } else {
                        error!(
                            error = %e,
                            topic_id = topic_id,
                            page = page,
                            "Failed to fetch posts for topic"
                        );
                        return Err(anyhow::anyhow!("Failed to fetch posts for topic: {}", e));
                    }
                }
            }
        }

        info!(
            topic_id = topic_id,
            total_unique_posts_fetched = total_unique_posts_fetched,
            total_posts_count = total_posts_count,
            "Finished updating posts for topic"
        );
        Ok(())
    }

    async fn process_post(
        post: Post,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        api_handler: Arc<ApiHandler>,
    ) {
        match db_handler.upsert_post(&post, dao_discourse_id).await {
            Ok(_) => {
                info!(post_id = post.id, "Successfully upserted post");
            }
            Err(e) => {
                if e.to_string().contains("fk_discourse_post_user") {
                    warn!(
                        post_id = post.id,
                        username = post.username,
                        "User not found, fetching user details"
                    );
                    let user_fetcher = UserIndexer::new(Arc::clone(&api_handler));
                    match user_fetcher
                        .fetch_user_by_username(&post.username, &db_handler, dao_discourse_id)
                        .await
                    {
                        Ok(_) => {
                            // Try to upsert the post again with the fetched user
                            if let Err(e) = db_handler.upsert_post(&post, dao_discourse_id).await {
                                error!(
                                    error = %e,
                                    post_id = post.id,
                                    "Failed to upsert post after fetching user"
                                );
                            }
                        }
                        Err(e) => {
                            warn!(
                                error = %e,
                                post_id = post.id,
                                username = post.username,
                                "Failed to fetch user, using unknown user"
                            );
                            // Get or create the unknown user
                            match db_handler
                                .get_or_create_unknown_user(dao_discourse_id)
                                .await
                            {
                                Ok(unknown_user) => {
                                    // Create a new post with the unknown user
                                    let mut unknown_post = post.clone();
                                    unknown_post.user_id = unknown_user.id;
                                    unknown_post.username = unknown_user.username.clone();

                                    // Upsert the post with the unknown user
                                    if let Err(e) = db_handler
                                        .upsert_post(&unknown_post, dao_discourse_id)
                                        .await
                                    {
                                        error!(
                                            error = %e,
                                            post_id = post.id,
                                            "Failed to upsert post with unknown user"
                                        );
                                    }
                                }
                                Err(e) => {
                                    error!(
                                        error = %e,
                                        post_id = post.id,
                                        "Failed to get or create unknown user"
                                    );
                                }
                            }
                        }
                    }
                } else {
                    error!(
                        error = %e,
                        post_id = post.id,
                        "Failed to upsert post"
                    );
                }
            }
        }
    }
}
