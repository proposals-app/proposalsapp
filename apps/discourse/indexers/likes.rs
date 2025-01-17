use crate::{db_handler::DbHandler, discourse_api::DiscourseApi, models::likes::PostLikeResponse};
use anyhow::{Context, Result};
use sea_orm::prelude::Uuid;
use std::sync::Arc;
use tracing::{error, info, instrument};

pub struct LikesIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl LikesIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id, post_id = post_id))]
    pub async fn fetch_and_store_likes(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        post_id: i32,
        priority: bool,
    ) -> Result<()> {
        let url = format!(
            "/post_action_users.json?id={}&post_action_type_id=2",
            post_id
        );

        info!(url, "Fetching likes for post");
        let response: PostLikeResponse = self
            .discourse_api
            .fetch(&url, priority)
            .await
            .with_context(|| format!("Failed to fetch likes for post {}", post_id))?;

        for user in response.post_action_users {
            if let Err(e) = db_handler
                .upsert_post_like(post_id, user.id, dao_discourse_id)
                .await
            {
                error!(
                    error = ?e,
                    post_id,
                    user_id = user.id,
                    "Failed to upsert post like"
                );
                return Err(e).context("Failed to upsert post like");
            }
        }

        info!(post_id, "Successfully processed likes");
        Ok(())
    }
}
