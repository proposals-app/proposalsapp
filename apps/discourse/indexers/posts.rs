use crate::{
    db_handler::{db, get_or_create_unknown_user, get_post_like_count, upsert_post},
    discourse_api::{DiscourseApi, has_http_status, process_upload_urls},
    indexers::{likes::LikesIndexer, users::UserIndexer},
    models::posts::{Post, PostResponse},
};
use anyhow::{Context, Result, bail};
use futures::stream::{self, StreamExt};
use proposalsapp_db::models::{discourse_post, discourse_topic};
use reqwest::{Client, StatusCode};
use sea_orm::{
    ColumnTrait, Condition, EntityTrait, FromQueryResult, QueryFilter, QuerySelect,
    prelude::{Expr, Uuid},
};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::Instant,
};
use tokio::{sync::Mutex, task};
use tracing::{debug, error, info, instrument, warn};

const POST_BATCH_SIZE: usize = 20;

#[derive(Clone)] // Add Clone derive
pub struct PostIndexer {
    discourse_api: Arc<DiscourseApi>,
    // Store UserIndexer and LikesIndexer to avoid recreating them repeatedly
    user_indexer: UserIndexer,
    likes_indexer: LikesIndexer,
    user_cache: Arc<Mutex<HashMap<String, i32>>>,
}

impl PostIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>) -> Self {
        // Create dependent indexers here, reusing the API and HTTP clients
        let user_indexer = UserIndexer::new(Arc::clone(&discourse_api), Arc::clone(&http_client));
        let likes_indexer = LikesIndexer::new(Arc::clone(&discourse_api));
        let user_cache = Arc::new(Mutex::new(HashMap::new()));
        Self {
            discourse_api,
            user_indexer,
            likes_indexer,
            user_cache,
        }
    }

    /// Fetches and updates all posts for a given topic ID.
    /// Marks posts found in the DB but not in the latest API fetch as deleted.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, topic_id = topic_id, priority = priority))]
    pub async fn update_posts_for_topic(
        &self,
        dao_discourse_id: Uuid,
        topic_id: i32,
        priority: bool, // Use priority for API requests if needed (e.g., for recent topics)
    ) -> Result<()> {
        #[derive(FromQueryResult)]
        struct ExistingPostId {
            external_id: i32,
        }

        let start_time = Instant::now();
        info!("Starting post update for topic");

        // Fetch existing post IDs for this topic from the database for deletion check later.
        let existing_db_posts = discourse_post::Entity::find()
            .select_only()
            .column(discourse_post::Column::ExternalId)
            .filter(
                Condition::all()
                    .add(discourse_post::Column::TopicId.eq(topic_id))
                    .add(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .into_model::<ExistingPostId>()
            .all(db())
            .await
            .context("Failed to fetch existing posts from DB")?;

        let existing_db_post_ids: HashSet<i32> = existing_db_posts
            .into_iter()
            .map(|post| post.external_id)
            .collect();
        debug!(
            topic_id,
            db_post_count = existing_db_post_ids.len(),
            "Found existing posts in DB"
        );

        let topic_url = format!("/t/{topic_id}.json?include_raw=true");
        let first_response: PostResponse =
            match self.discourse_api.queue(&topic_url, priority).await {
                Ok(response) => response,
                Err(error) if has_http_status(&error, StatusCode::NOT_FOUND) => {
                    warn!(topic_id, "Topic is no longer public; marking it invisible");
                    discourse_topic::Entity::update_many()
                        .col_expr(discourse_topic::Column::Visible, Expr::value(false))
                        .filter(
                            Condition::all()
                                .add(discourse_topic::Column::ExternalId.eq(topic_id))
                                .add(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse_id)),
                        )
                        .exec(db())
                        .await
                        .context("Failed to mark unavailable topic invisible")?;
                    return Ok(());
                }
                Err(error) => {
                    return Err(error)
                        .with_context(|| format!("Failed to fetch topic {topic_id} post stream"));
                }
            };

        let expected_post_ids: HashSet<i32> =
            first_response.post_stream.stream.iter().copied().collect();
        if expected_post_ids.len() != first_response.post_stream.stream.len() {
            bail!("Topic {topic_id} returned duplicate post IDs in its post stream");
        }

        let mut seen_in_api_post_ids = self
            .process_posts(first_response.post_stream.posts, dao_discourse_id, priority)
            .await?;

        if !seen_in_api_post_ids.is_subset(&expected_post_ids) {
            bail!("Topic {topic_id} returned posts outside its authoritative post stream");
        }

        let remaining_ids: Vec<i32> = first_response
            .post_stream
            .stream
            .into_iter()
            .filter(|post_id| !seen_in_api_post_ids.contains(post_id))
            .collect();

        for requested_ids in remaining_ids.chunks(POST_BATCH_SIZE) {
            let mut url = format!("/t/{topic_id}/posts.json?include_raw=true");
            for post_id in requested_ids {
                url.push_str("&post_ids%5B%5D=");
                url.push_str(&post_id.to_string());
            }

            let response: PostResponse = self
                .discourse_api
                .queue(&url, priority)
                .await
                .with_context(|| format!("Failed to fetch post batch for topic {topic_id}"))?;
            let returned_ids: HashSet<i32> = response
                .post_stream
                .posts
                .iter()
                .map(|post| post.id)
                .collect();
            let requested_id_set: HashSet<i32> = requested_ids.iter().copied().collect();
            if returned_ids != requested_id_set {
                bail!(
                    "Topic {topic_id} post batch was incomplete: requested {}, received {}",
                    requested_id_set.len(),
                    returned_ids.len()
                );
            }

            seen_in_api_post_ids.extend(
                self.process_posts(response.post_stream.posts, dao_discourse_id, priority)
                    .await?,
            );
        }

        if seen_in_api_post_ids != expected_post_ids {
            bail!(
                "Topic {topic_id} post stream was not fully processed: expected {}, processed {}",
                expected_post_ids.len(),
                seen_in_api_post_ids.len()
            );
        }

        // --- Mark Deleted Posts ---
        // Find posts in the DB that were *not* seen in the API response during this run.
        let posts_to_mark_deleted_ids: Vec<i32> = existing_db_post_ids
            .difference(&expected_post_ids)
            .cloned()
            .collect();

        if !posts_to_mark_deleted_ids.is_empty() {
            info!(
                topic_id,
                count = posts_to_mark_deleted_ids.len(),
                "Marking posts as deleted (not found in latest API fetch)"
            );

            let update_result = discourse_post::Entity::update_many()
                .col_expr(discourse_post::Column::Deleted, Expr::value(true)) // Set deleted = true
                // Also update the 'cooked' field to NULL or empty for deleted posts
                .col_expr(discourse_post::Column::Cooked, Expr::value(""))
                .filter(
                    Condition::all()
                        .add(discourse_post::Column::ExternalId.is_in(posts_to_mark_deleted_ids))
                        .add(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
                        .add(discourse_post::Column::TopicId.eq(topic_id)), // Ensure only for this topic
                )
                .exec(db())
                .await
                .context("Failed to mark posts as deleted in DB")?;

            info!(
                topic_id,
                rows_affected = update_result.rows_affected,
                "Finished marking posts as deleted"
            );
        } else {
            debug!(topic_id, "No posts needed to be marked as deleted.");
        }

        let duration = start_time.elapsed();
        info!(
            topic_id,
            total_processed_posts = seen_in_api_post_ids.len(),
            duration = ?duration,
            "Finished updating posts for topic"
        );
        Ok(())
    }

    async fn process_posts(
        &self,
        posts: Vec<Post>,
        dao_discourse_id: Uuid,
        priority: bool,
    ) -> Result<HashSet<i32>> {
        let post_ids: HashSet<i32> = posts.iter().map(|post| post.id).collect();
        if post_ids.len() != posts.len() {
            bail!("Discourse returned duplicate posts in one response batch");
        }

        let processing_results = stream::iter(posts)
            .map(|post| {
                let user_indexer = self.user_indexer.clone();
                let likes_indexer = self.likes_indexer.clone();
                let user_cache = Arc::clone(&self.user_cache);
                let api_handler = Arc::clone(&self.discourse_api);

                task::spawn(async move {
                    Self::process_single_post(
                        post,
                        dao_discourse_id,
                        api_handler,
                        user_indexer,
                        likes_indexer,
                        user_cache,
                        priority,
                    )
                    .await
                })
            })
            .buffer_unordered(10)
            .collect::<Vec<_>>()
            .await;

        for result in processing_results {
            result.context("Post processing task panicked or was cancelled")??;
        }

        Ok(post_ids)
    }

    /// Processes a single post: ensures user exists, processes content, upserts post, fetches likes
    /// if needed.
    #[instrument(skip(post, discourse_api, user_indexer, likes_indexer, user_cache), fields(post_id = %post.id, username = %post.username, priority = priority))]
    async fn process_single_post(
        mut post: Post, // Take ownership
        dao_discourse_id: Uuid,
        discourse_api: Arc<DiscourseApi>,
        user_indexer: UserIndexer, // Receive cloned indexers
        likes_indexer: LikesIndexer,
        user_cache: Arc<Mutex<HashMap<String, i32>>>,
        priority: bool,
    ) -> Result<()> {
        // Return Result for error propagation
        debug!("Processing single post.");

        // 1. Ensure User Exists or use Unknown User
        let username = post.username.clone();
        let cached_user_id = {
            let cache = user_cache.lock().await;
            cache.get(&username).copied()
        };

        match cached_user_id {
            Some(user_id) => {
                if post.user_id != user_id {
                    warn!(post_id = post.id, post_user_id = post.user_id, cached_user_id = user_id, username = %username, "Post user ID mismatch after cache lookup. Updating post data.");
                    post.user_id = user_id;
                }
            }
            None => {
                match user_indexer
                    .fetch_and_upsert_user(&username, dao_discourse_id, priority)
                    .await
                {
                    Ok(user_id) => {
                        if post.user_id != user_id {
                            warn!(post_id = post.id, post_user_id = post.user_id, fetched_user_id = user_id, username = %username, "Post user ID mismatch after fetching user. Updating post data.");
                            post.user_id = user_id;
                        }
                        let mut cache = user_cache.lock().await;
                        cache.insert(username.clone(), user_id);
                    }
                    Err(e) => {
                        warn!(username = %username, error = ?e, "Failed to fetch or upsert user, assigning to 'unknown_user'.");
                        match get_or_create_unknown_user(dao_discourse_id).await {
                            Ok(unknown_user) => {
                                post.user_id = unknown_user.id;
                                post.username = unknown_user.username.clone();
                                post.avatar_template = unknown_user.avatar_template;
                                post.display_username = unknown_user.name;
                            }
                            Err(e_unknown) => {
                                error!(error = ?e_unknown, post_id = post.id, "Failed to get or create 'unknown_user'. Skipping post upsert.");
                                return Err(
                                    e_unknown.context("Failed to get/create unknown user for post")
                                );
                            }
                        }
                    }
                }
            }
        };

        // 2. Process Raw Content (e.g., replace upload URLs)
        // This function is now sync, no need for spawn_blocking
        if let Some(raw_content) = &post.raw {
            let processed_content = process_upload_urls(raw_content, &discourse_api.base_url);
            post.raw = Some(processed_content); // Update post object
        }

        // 3. Upsert Post to Database
        let post_external_id = post.id;
        upsert_post(&post, dao_discourse_id)
            .await
            .with_context(|| format!("Failed upsert_post for {post_external_id}"))?;
        debug!(post_id = post_external_id, "Post upserted successfully.");

        // 4. Reconcile likes whenever the provider count differs in either direction.
        let api_like_count = post
            .actions_summary
            .iter()
            .find(|item| item.id == 2)
            .map(|item| item.count)
            .unwrap_or_default();
        let db_like_count = get_post_like_count(post_external_id, dao_discourse_id)
            .await
            .context("Failed to get indexed post-like count")?;
        if api_like_count != db_like_count {
            info!(
                post_id = post_external_id,
                api_like_count, db_like_count, "Reconciling post likes"
            );
            likes_indexer
                .fetch_and_store_likes(dao_discourse_id, post_external_id, priority)
                .await
                .context("Failed to reconcile post likes")?;
        }

        Ok(()) // Indicate successful processing of this post
    }
}
