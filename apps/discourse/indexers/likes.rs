use crate::{
    MAX_PAGES_PER_RUN, db_handler::upsert_post_likes_batch, discourse_api::DiscourseApi,
    indexers::PageCursor, models::likes::PostLikeResponse,
};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{debug, info, instrument};

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

        loop {
            let page = pager.page();
            // API endpoint for fetching users who performed action type 2 (like) on a post
            let url = format!(
                "/post_action_users.json?id={post_id}&post_action_type_id=2&page={page}&limit={LIKE_PAGE_SIZE}"
            );

            debug!(%url, "Fetching likes for post");
            let response: PostLikeResponse = self
                .discourse_api
                .queue(&url, priority) // Use priority flag
                .await
                .with_context(|| format!("Failed to fetch likes for post_id {post_id}"))?;

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

            // Perform batch upsert into the database
            upsert_post_likes_batch(post_id, user_ids, dao_discourse_id)
                .await
                .with_context(|| format!("Failed to batch upsert likes for post_id {post_id}"))?;

            total_processed += num_users as i32;

            if let Some(total) = total_rows
                && total_processed >= total
            {
                break;
            }

            if !pager.advance("post likes pages") {
                break;
            }
        }

        info!(post_id, total_processed, "Successfully processed likes.");
        Ok(())
    }
}
