use crate::{
    db_handler::upsert_topic,
    discourse_api::DiscourseApi,
    indexers::{MAX_PAGES_PER_RUN, RECENT_LOOKBACK_HOURS, posts::PostIndexer},
    models::topics::TopicResponse,
};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use reqwest::Client;
use sea_orm::prelude::Uuid;
use std::{sync::Arc, time::Instant};
use tokio::task::JoinSet;
use tracing::{debug, error, info, instrument, warn};

// Derive Clone for TopicIndexer
#[derive(Clone)]
pub struct TopicIndexer {
    discourse_api: Arc<DiscourseApi>,
    // http_client: Arc<Client>, // Removed, http_client is owned by PostIndexer now
    post_indexer: PostIndexer,
}

impl TopicIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>, http_client: Arc<Client>) -> Self {
        let post_indexer = PostIndexer::new(Arc::clone(&discourse_api), Arc::clone(&http_client));
        Self {
            discourse_api,
            post_indexer,
        }
    }

    /// Fetches and updates topics based on recent activity (e.g., new posts, bumps).
    /// Uses high priority for API requests.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_topics(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting update of recent topics (high priority)");
        self.update_topics_internal(
            dao_discourse_id,
            false,                                        /* recent: uses activity descending */
            true,                                         /* priority */
            Some(Duration::hours(RECENT_LOOKBACK_HOURS)), /* lookback duration */
        )
        .await
    }

    /// Fetches and updates *all* topics, ordered by creation date (ascending).
    /// This is a full refresh/backfill task. Uses low priority for API requests.
    /// Always updates posts for topics encountered during a full refresh.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_topics(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting full update of all topics (low priority)");
        self.update_topics_internal(
            dao_discourse_id,
            true,  /* all: uses created ascending */
            false, /* priority */
            None,  /* no lookback duration */
        )
        .await
    }

    /// Internal helper to fetch and process topics based on parameters.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, fetch_all = fetch_all, priority = priority, ?lookback))]
    async fn update_topics_internal(
        &self,
        dao_discourse_id: Uuid,
        fetch_all: bool, // True for full refresh (created asc), false for recent (activity desc)
        priority: bool,
        lookback: Option<Duration>, // Used only when fetch_all is false
    ) -> Result<()> {
        let start_time = Instant::now();
        info!("Starting topic update process");

        let mut total_processed_topics = 0;
        let mut page: u32 = 0; // Use u32 for page
        let mut join_set = JoinSet::new(); // For concurrent post updates
        let max_concurrent_post_updates = 10; // Limit concurrency

        let lookback_cutoff = lookback.map(|dur| Utc::now() - dur);
        debug!(?lookback_cutoff, "Using lookback cutoff for recent topics");

        let mut stop_pagination = false; // Flag to break outer loop

        loop {
            if stop_pagination {
                break;
            }

            // Determine API endpoint parameters based on refresh type
            let (order_by, ascending_param) = if fetch_all {
                ("created", "&ascending=true") // Full refresh: oldest first
            } else {
                ("activity", "") // Recent updates: most recently active first (default desc)
            };

            let url = format!(
                "/latest.json?order={}{}&page={}",
                order_by, ascending_param, page
            );
            debug!(%url, "Fetching topics page");

            match self
                .discourse_api
                .queue::<TopicResponse>(&url, priority) // Use priority flag
                .await
            {
                Ok(response) => {
                    let topics_on_page = response.topic_list.topics;
                    let num_topics_on_page = topics_on_page.len();
                    let per_page_api = response.topic_list.per_page; // Use this to detect last page more reliably

                    if topics_on_page.is_empty() {
                        info!(page, "Received empty topic list. Stopping pagination.");
                        stop_pagination = true; // Signal to break outer loop
                        continue; // Skip processing this empty page
                    }

                    let mut topics_to_process_posts = Vec::new();

                    for topic in topics_on_page {
                        // Check lookback cutoff for recent updates
                        if !fetch_all {
                            if let Some(cutoff) = lookback_cutoff {
                                // Use bumped_at or last_posted_at for activity check
                                if topic.bumped_at < cutoff {
                                    info!(topic_id = topic.id, bumped_at = %topic.bumped_at, ?cutoff, "Reached topic older than lookback cutoff. Stopping pagination.");
                                    stop_pagination = true; // Signal outer loop break
                                    break; // Stop processing this page
                                }
                            }
                        }

                        total_processed_topics += 1;
                        let topic_external_id = topic.id; // Store for logging/potential use

                        // Upsert the topic information first
                        match upsert_topic(&topic, dao_discourse_id).await {
                            Ok(_) => {
                                // Always queue post update for now (both recent and full)
                                topics_to_process_posts.push(topic);
                            }
                            Err(e) => {
                                error!(error = ?e, topic_id = topic_external_id, "Failed to upsert topic, skipping post update for this topic.");
                                // Continue to next topic on the page
                            }
                        }
                    } // End loop through topics on page

                    // If lookback cutoff was hit, we don't need to spawn tasks for this page
                    if stop_pagination {
                        continue;
                    }

                    // Spawn tasks to update posts for the selected topics
                    for topic_to_update in topics_to_process_posts {
                        // Limit concurrency
                        while join_set.len() >= max_concurrent_post_updates {
                            if let Some(res) = join_set.join_next().await {
                                Self::handle_join_result(res);
                            } else {
                                // Should not happen unless JoinSet is already empty, but handle defensively
                                break;
                            }
                        }

                        let post_fetcher = self.post_indexer.clone(); // Clone the PostIndexer
                        let dao_id_clone = dao_discourse_id;
                        let topic_id_clone = topic_to_update.id;

                        debug!(topic_id = topic_id_clone, "Spawning post update task");
                        join_set.spawn(async move {
                            post_fetcher
                                .update_posts_for_topic(dao_id_clone, topic_id_clone, priority)
                                .await
                                // Wrap result for joinset handling
                                .map_err(|e| e.context(format!("Post update failed for topic {}", topic_id_clone)))
                        });
                    }

                    info!(
                        page,
                        num_topics_on_page,
                        total_processed_topics,
                        active_post_tasks = join_set.len(),
                        "Processed topics page"
                    );

                    // Check termination conditions
                    // 1. API returned fewer items than per_page (reliable way to detect last page)
                    if num_topics_on_page < per_page_api as usize && per_page_api > 0 {
                        info!(
                            page,
                            num_topics_on_page, per_page_api, "Received fewer topics than per_page limit. Stopping pagination."
                        );
                        stop_pagination = true; // Signal outer loop break
                    }
                    // 2. Safety break
                    if page >= MAX_PAGES_PER_RUN {
                        error!(
                            page,
                            MAX_PAGES_PER_RUN, "Reached maximum topic page limit. Stopping."
                        );
                        stop_pagination = true; // Signal outer loop break
                    }

                    page += 1; // Increment page for the next iteration
                }
                Err(e) => {
                    // Handle 404 - could be end of pages or transient issue
                    if e.to_string().contains("404") || e.to_string().contains("Not Found") {
                        info!(page, url=%url, "Received 404/Not Found fetching topics. Assuming end of pages.");
                        stop_pagination = true; // Stop pagination
                    } else {
                        error!(error = ?e, page, url = %url, "Failed to fetch topics page");
                        // Return error to stop the entire topic update process for this run
                        // Also wait for any spawned tasks before returning
                        while let Some(result) = join_set.join_next().await {
                            Self::handle_join_result(result);
                        }
                        return Err(e).context(format!("Failed to fetch topics page {}", page));
                    }
                }
            }
        } // End loop

        info!(
            total_processed_topics,
            "Finished fetching topics. Waiting for remaining post update tasks..."
        );

        // Wait for all remaining spawned post update tasks to complete
        while let Some(result) = join_set.join_next().await {
            Self::handle_join_result(result);
        }

        let duration = start_time.elapsed();
        info!(total_processed_topics, duration = ?duration, "Finished updating topics and associated posts.");
        Ok(())
    }

    /// Handles the result of a completed task from the JoinSet.
    fn handle_join_result(result: Result<Result<()>, tokio::task::JoinError>) {
        match result {
            Ok(Ok(())) => { /* Task completed successfully */ }
            Ok(Err(e)) => {
                // Task completed with an application error (logged within the task's context)
                warn!(error = ?e, "Post update task failed.");
            }
            Err(e) => {
                // Task panicked or was cancelled
                error!(error = ?e, "Post update task join error (panic or cancellation).");
            }
        }
    }
}
