use crate::{
    db_handler::{db, get_or_create_unknown_user, get_post_like_count, upsert_post},
    discourse_api::{DiscourseApi, process_upload_urls},
    indexers::{MAX_PAGES_PER_RUN, likes::LikesIndexer, users::UserIndexer},
    models::posts::{Post, PostResponse},
};
use anyhow::{Context, Result};
use futures::stream::{self, StreamExt};
use proposalsapp_db_indexer::models::discourse_post;
use reqwest::Client;
use sea_orm::{
    ColumnTrait, Condition, EntityTrait, QueryFilter,
    prelude::{Expr, Uuid},
};
use std::{collections::HashSet, sync::Arc, time::Instant};
use tokio::task;
use tracing::{debug, error, info, instrument, warn};

#[derive(Clone)] // Add Clone derive
pub struct PostIndexer {
    discourse_api: Arc<DiscourseApi>,
    // Store UserIndexer and LikesIndexer to avoid recreating them repeatedly
    user_indexer: UserIndexer,
    likes_indexer: LikesIndexer,
}

impl PostIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>) -> Self {
        // Create dependent indexers here, reusing the API and HTTP clients
        let user_indexer = UserIndexer::new(Arc::clone(&discourse_api), Arc::clone(&http_client));
        let likes_indexer = LikesIndexer::new(Arc::clone(&discourse_api));
        Self {
            discourse_api,
            user_indexer,
            likes_indexer,
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
        let start_time = Instant::now();
        info!("Starting post update for topic");

        // Fetch existing post IDs for this topic from the database for deletion check later.
        let existing_db_posts = discourse_post::Entity::find()
            .filter(
                Condition::all()
                    .add(discourse_post::Column::TopicId.eq(topic_id))
                    .add(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id)),
            )
            .all(db())
            .await
            .context("Failed to fetch existing posts from DB")?;

        let existing_db_post_ids: HashSet<i32> = existing_db_posts
            .iter()
            .map(|post| post.external_id)
            .collect();
        debug!(
            topic_id,
            db_post_count = existing_db_post_ids.len(),
            "Found existing posts in DB"
        );

        let mut page: u32 = 0; // Use u32 for page number
        let mut total_api_posts_count: Option<i32> = None; // Initialize lazily from first response
        let mut total_processed_posts: i32 = 0;
        let mut seen_in_api_post_ids: HashSet<i32> = HashSet::new();

        loop {
            let url = format!("/t/{}.json?include_raw=true&page={}", topic_id, page + 1); // API often 1-based page
            debug!(%url, "Fetching posts page");

            match self
                .discourse_api
                .queue::<PostResponse>(&url, priority) // Use priority flag
                .await
            {
                Ok(response) => {
                    // Initialize total post count from the first response
                    if total_api_posts_count.is_none() {
                        total_api_posts_count = Some(response.posts_count);
                        info!(
                            topic_id,
                            total_api_posts = response.posts_count,
                            "Total posts reported by API"
                        );
                    }

                    let posts_on_page = response.post_stream.posts;
                    let num_posts_on_page = posts_on_page.len() as i32;
                    let is_empty = posts_on_page.is_empty();

                    if is_empty && page > 0 {
                        // If we get an empty page after the first page, assume we're done.
                        info!(
                            topic_id,
                            page, "Received empty post list. Assuming end of posts."
                        );
                        break;
                    }
                    if is_empty && page == 0 {
                        info!(topic_id, "Topic contains no posts.");
                        break;
                    }

                    // Collect IDs seen in this API response page
                    let current_page_ids: HashSet<i32> = posts_on_page.iter().map(|p| p.id).collect();
                    seen_in_api_post_ids.extend(current_page_ids);

                    // Process posts concurrently using buffer_unordered
                    // Wrap the processing in a task to handle potential errors per post
                    let processing_results = stream::iter(posts_on_page)
                        .map(|post| {
                            let user_indexer = self.user_indexer.clone(); // Clone Arcs for the task
                            let likes_indexer = self.likes_indexer.clone();
                            let api_handler = Arc::clone(&self.discourse_api); // Clone API handler Arc

                            task::spawn(async move {
                                Self::process_single_post(
                                    post, // Takes ownership of post
                                    dao_discourse_id,
                                    api_handler,
                                    user_indexer,
                                    likes_indexer,
                                    priority,
                                )
                                .await
                            })
                        })
                        .buffer_unordered(10) // Limit concurrency
                        .collect::<Vec<_>>() // Collect join handles
                        .await;

                    // Check results from concurrent processing
                    let mut post_errors = Vec::new();
                    for result in processing_results {
                        match result {
                            Ok(Ok(_)) => { /* Post processed successfully */ }
                            Ok(Err(e)) => {
                                // Error occurred within process_single_post
                                error!(error = ?e, "Error processing individual post");
                                post_errors.push(e);
                            }
                            Err(join_err) => {
                                // Task panicked or was cancelled
                                error!(error = ?join_err, "Post processing task failed");
                                post_errors.push(anyhow::Error::new(join_err).context("Post processing task failed"));
                            }
                        }
                    }

                    // Optionally aggregate or handle post_errors (e.g., return first error or log summary)
                    if !post_errors.is_empty() {
                        warn!(
                            topic_id,
                            num_errors = post_errors.len(),
                            "Encountered errors processing some posts for topic"
                        );
                        // Could return the first error if needed: return
                        // Err(post_errors.remove(0));
                    }

                    total_processed_posts += num_posts_on_page;

                    info!(
                        topic_id,
                        page = page + 1,
                        num_posts_on_page,
                        total_processed_posts,
                        reported_total = total_api_posts_count.unwrap_or(-1),
                        "Processed posts page"
                    );

                    // Check termination conditions
                    // 1. If total processed meets or exceeds reported total (if reliable)
                    if let Some(total_count) = total_api_posts_count {
                        // Use >= because post count might fluctuate slightly during fetch
                        if total_processed_posts >= total_count {
                            info!(
                                topic_id,
                                total_processed_posts, total_count, "Reached or exceeded reported post count. Stopping."
                            );
                            break;
                        }
                    }
                    // 2. Safety break after max pages
                    if page >= MAX_PAGES_PER_RUN {
                        error!(
                            topic_id,
                            page, MAX_PAGES_PER_RUN, "Reached maximum post page limit. Stopping."
                        );
                        break;
                    }

                    page += 1;
                }
                Err(e) => {
                    // Handle 404 specifically - might indicate end of pages or deleted topic
                    if e.to_string().contains("404") || e.to_string().contains("Not Found") {
                        warn!(topic_id, page, url=%url, "Received 404/Not Found fetching posts. Assuming end of pages or deleted topic.");
                        // Check if *any* posts were processed for this topic. If not, maybe topic was deleted.
                        if total_processed_posts == 0 && page == 0 {
                            warn!(
                                topic_id,
                                "Topic might be deleted (404 on first page fetch)."
                            );
                            // Consider marking the topic itself as potentially deleted if needed
                            // elsewhere.
                        }
                        break; // Stop pagination for this topic on 404
                    } else {
                        error!(error = ?e, topic_id, page, url = %url, "Failed to fetch posts page");
                        // Return error to stop processing this topic
                        return Err(e).context(format!(
                            "Failed to fetch posts page {} for topic {}",
                            page + 1,
                            topic_id
                        ));
                    }
                }
            }
        } // End loop

        // --- Mark Deleted Posts ---
        // Find posts in the DB that were *not* seen in the API response during this run.
        let posts_to_mark_deleted_ids: Vec<i32> = existing_db_post_ids
            .difference(&seen_in_api_post_ids)
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
            total_processed_posts,
            duration = ?duration,
            "Finished updating posts for topic"
        );
        Ok(())
    }

    /// Processes a single post: ensures user exists, processes content, upserts post, fetches likes
    /// if needed.
    #[instrument(skip(post, discourse_api, user_indexer, likes_indexer), fields(post_id = %post.id, username = %post.username, priority = priority))]
    async fn process_single_post(
        mut post: Post, // Take ownership
        dao_discourse_id: Uuid,
        discourse_api: Arc<DiscourseApi>,
        user_indexer: UserIndexer, // Receive cloned indexers
        likes_indexer: LikesIndexer,
        priority: bool,
    ) -> Result<()> {
        // Return Result for error propagation
        debug!("Processing single post.");

        // 1. Ensure User Exists or use Unknown User
        match user_indexer
            .fetch_and_upsert_user(&post.username, dao_discourse_id, priority)
            .await
        {
            Ok(user_id) => {
                if post.user_id != user_id {
                    warn!(post_id = post.id, post_user_id = post.user_id, fetched_user_id = user_id, username = %post.username, "Post user ID mismatch after fetching user. Updating post data.");
                    post.user_id = user_id;
                }
            }
            Err(e) => {
                warn!(username = %post.username, error = ?e, "Failed to fetch or upsert user, assigning to 'unknown_user'.");
                match get_or_create_unknown_user(dao_discourse_id).await {
                    Ok(unknown_user) => {
                        post.user_id = unknown_user.id;
                        post.username = unknown_user.username.clone();
                        post.avatar_template = unknown_user.avatar_template;
                        post.display_username = unknown_user.name;
                    }
                    Err(e_unknown) => {
                        error!(error = ?e_unknown, post_id = post.id, "Failed to get or create 'unknown_user'. Skipping post upsert.");
                        return Err(e_unknown.context("Failed to get/create unknown user for post"));
                    }
                }
            }
        };

        // 2. Process Raw Content (e.g., replace upload URLs)
        // This function is now sync, no need for spawn_blocking
        if let Some(raw_content) = &post.raw {
            let processed_content = process_upload_urls(raw_content, discourse_api); // Call directly
            post.raw = Some(processed_content); // Update post object
        }

        // 3. Upsert Post to Database
        let post_external_id = post.id;
        upsert_post(&post, dao_discourse_id)
            .await
            .with_context(|| format!("Failed upsert_post for {}", post_external_id))?;
        debug!(post_id = post_external_id, "Post upserted successfully.");

        // 4. Check and Fetch Likes if Necessary
        if let Some(like_action) = post.actions_summary.iter().find(|item| item.id == 2) {
            let api_like_count = like_action.count;
            if api_like_count > 0 {
                match get_post_like_count(post_external_id, dao_discourse_id).await {
                    Ok(db_like_count) => {
                        if api_like_count > db_like_count {
                            info!(
                                post_id = post_external_id,
                                api_like_count, db_like_count, "API shows more likes than DB, fetching updates."
                            );
                            if let Err(e) = likes_indexer
                                .fetch_and_store_likes(dao_discourse_id, post_external_id, priority)
                                .await
                            {
                                error!(error = ?e, post_id = post_external_id, "Failed to fetch/store likes");
                            }
                        } else {
                            debug!(
                                post_id = post_external_id,
                                api_like_count, db_like_count, "DB like count is up-to-date."
                            );
                        }
                    }
                    Err(e) => {
                        error!(error = ?e, post_id = post_external_id, "Failed to get DB like count");
                    }
                }
            } else {
                debug!(
                    post_id = post_external_id,
                    "Post has no likes according to API summary."
                );
                // Optionally: Check DB count and delete if api_like_count is 0 but db_like_count >
                // 0
            }
        } else {
            debug!(
                post_id = post_external_id,
                "No like action summary found for post."
            );
        }

        Ok(()) // Indicate successful processing of this post
    }
}
