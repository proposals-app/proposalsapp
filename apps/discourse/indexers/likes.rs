use crate::{
    MAX_PAGES_PER_RUN,
    db_handler::sync_post_likes,
    discourse_api::{DiscourseApi, has_http_status},
    indexers::PageCursor,
    models::likes::PostLikeResponse,
};
use anyhow::{Context, Result};
use reqwest::StatusCode;
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{debug, info, instrument, warn};

const LIKE_PAGE_SIZE: u32 = 50;

#[derive(Clone)] // Add Clone derive
pub struct LikesIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl LikesIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    /// Fetches all users who liked a specific post and updates the database.
    /// Uses batch upsert for efficiency.
    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id, post_id = post_id, priority = priority))]
    pub async fn fetch_and_store_likes(
        &self,
        dao_discourse_id: Uuid,
        post_id: i32,   // External Discourse Post ID
        priority: bool, // Whether to use priority queue for the API request
    ) -> Result<()> {
        info!("Fetching and storing likes for post");

        let mut pager = PageCursor::new(MAX_PAGES_PER_RUN);
        let mut total_rows: Option<i32> = None;
        let mut total_processed = 0;
        let mut all_user_ids = Vec::new();

        loop {
            let page = pager.page();
            // API endpoint for fetching users who performed action type 2 (like) on a post
            let url = format!(
                "/post_action_users.json?id={post_id}&post_action_type_id=2&page={page}&limit={LIKE_PAGE_SIZE}"
            );

            debug!(%url, "Fetching likes for post");
            let response: PostLikeResponse = match self.discourse_api.queue(&url, priority).await {
                Ok(response) => response,
                Err(error) if has_http_status(&error, StatusCode::FORBIDDEN) => {
                    warn!(
                        post_id,
                        "Discourse does not expose this post's liker identities; preserving indexed likes"
                    );
                    return Ok(());
                }
                Err(error) => {
                    return Err(error)
                        .with_context(|| format!("Failed to fetch likes for post_id {post_id}"));
                }
            };

            let user_ids: Vec<i32> = response
                .post_action_users
                .into_iter()
                .map(|user| user.id)
                .collect();

            if user_ids.is_empty() {
                if total_processed == 0 {
                    info!(post_id, "No likes returned by API.");
                }
                break;
            }

            if total_rows.is_none() {
                total_rows = response.total_rows_post_action_users;
            }

            let num_users = user_ids.len();
            debug!(
                post_id,
                num_users, "Received likes, preparing batch upsert."
            );

            total_processed += num_users as i32;
            all_user_ids.extend(user_ids);

            if let Some(total) = total_rows
                && total_processed >= total
            {
                break;
            }

            pager.advance("post likes pages")?;
        }

        sync_post_likes(post_id, all_user_ids, dao_discourse_id)
            .await
            .with_context(|| format!("Failed to reconcile likes for post_id {post_id}"))?;

        info!(post_id, total_processed, "Successfully processed likes.");
        Ok(())
    }
}
