use crate::{
    db_handler::upsert_post_likes_batch, discourse_api::DiscourseApi,
    models::likes::PostLikeResponse,
};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{debug, info, instrument};

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

        // API endpoint for fetching users who performed action type 2 (like) on a post
        let url = format!(
            "/post_action_users.json?id={}&post_action_type_id=2",
            post_id
        );

        debug!(%url, "Fetching likes for post");
        let response: PostLikeResponse = self
            .discourse_api
            .queue(&url, priority) // Use priority flag
            .await
            .with_context(|| format!("Failed to fetch likes for post_id {}", post_id))?;

        // Extract user IDs from the response
        let user_ids: Vec<i32> = response
            .post_action_users
            .into_iter()
            .map(|user| user.id) // Extract just the ID
            .collect();

        let num_users = user_ids.len();
        debug!(
            post_id,
            num_users, "Received likes, preparing batch upsert."
        );

        // Perform batch upsert into the database
        upsert_post_likes_batch(post_id, user_ids, dao_discourse_id)
            .await
            .with_context(|| format!("Failed to batch upsert likes for post_id {}", post_id))?;

        info!(
            post_id,
            num_users_processed = num_users,
            "Successfully processed likes."
        );
        Ok(())
    }
}
