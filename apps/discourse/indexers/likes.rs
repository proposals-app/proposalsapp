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
        info!("Fetching and storing likes for post");

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

        let user_ids = response
            .post_action_users
            .into_iter()
            .map(|user| user.id)
            .collect::<Vec<_>>();

        if let Err(e) = db_handler
            .upsert_post_likes_batch(post_id, user_ids, dao_discourse_id)
            .await
        {
            error!(
                error = ?e,
                post_id,
                "Failed to batch upsert post likes"
            );
            return Err(e).context("Failed to batch upsert post likes");
        }

        info!(post_id, "Successfully processed likes");
        Ok(())
    }
}
