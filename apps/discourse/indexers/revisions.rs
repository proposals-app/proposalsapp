use crate::{
    db_handler::upsert_revision,
    discourse_api::{process_upload_urls, DiscourseApi},
    models::revisions::Revision,
    DB,
};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::discourse_post;
use sea_orm::{prelude::Uuid, ColumnTrait, EntityTrait, QueryFilter};
use std::sync::Arc;
use tokio::task::JoinSet;
use tracing::{error, info, instrument};

pub struct RevisionIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl RevisionIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self, ), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_revisions(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update all revisions");

        let posts = self
            .fetch_posts_with_revisions(dao_discourse_id)
            .await
            .context("Failed to fetch posts with revisions")?;
        let mut join_set = JoinSet::new();

        for post in posts {
            let api_handler = self.discourse_api.clone();
            join_set.spawn(async move {
                if let Err(e) = update_revisions_for_post(&api_handler, dao_discourse_id, &post, false).await {
                    error!(
                        error = ?e,
                        post_id = post.external_id,
                        "Error updating revisions for post"
                    );
                }
            });
        }

        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                error!(error = ?e, "Error in revision tasks");
            }
        }

        info!("Finished updating all revisions");
        Ok(())
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_revisions(&self, dao_discourse_id: Uuid) -> Result<()> {
        info!("Starting to update recent revisions");

        let posts = self
            .fetch_recent_posts_with_revisions(dao_discourse_id)
            .await
            .context("Failed to fetch recent posts with revisions")?;
        let mut join_set = JoinSet::new();

        for post in posts {
            let api_handler = self.discourse_api.clone();
            join_set.spawn(async move {
                if let Err(e) = update_revisions_for_post(&api_handler, dao_discourse_id, &post, true).await {
                    error!(
                        error = ?e,
                        post_id = post.external_id,
                        "Error updating revisions for post"
                    );
                }
            });
        }

        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                error!(error = ?e, "Error in revision tasks");
            }
        }

        info!("Finished updating recent revisions");
        Ok(())
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    async fn fetch_posts_with_revisions(&self, dao_discourse_id: Uuid) -> Result<Vec<discourse_post::Model>> {
        info!("Fetching posts with revisions");

        let posts = discourse_post::Entity::find()
            .filter(discourse_post::Column::Version.gt(1))
            .filter(discourse_post::Column::CanViewEditHistory.eq(true))
            .filter(discourse_post::Column::Deleted.eq(false))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch posts with revisions")?;

        info!(
            posts_count = posts.len(),
            "Fetched posts with incomplete revisions"
        );
        Ok(posts)
    }

    #[instrument(skip(self), fields(dao_discourse_id = %dao_discourse_id))]
    async fn fetch_recent_posts_with_revisions(&self, dao_discourse_id: Uuid) -> Result<Vec<discourse_post::Model>> {
        info!("Fetching recent posts with revisions");

        let one_hour_ago = Utc::now() - Duration::hours(1);

        let posts = discourse_post::Entity::find()
            .filter(discourse_post::Column::Version.gt(1))
            .filter(discourse_post::Column::CanViewEditHistory.eq(true))
            .filter(discourse_post::Column::Deleted.eq(false))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .filter(discourse_post::Column::UpdatedAt.gte(one_hour_ago.naive_utc()))
            .all(DB.get().unwrap())
            .await
            .context("Failed to fetch recent posts with revisions")?;

        info!(
            posts_count = posts.len(),
            "Fetched recent posts with incomplete revisions"
        );
        Ok(posts)
    }
}

#[instrument(skip(discourse_api), fields( dao_discourse_id = %dao_discourse_id))]
async fn update_revisions_for_post(discourse_api: &DiscourseApi, dao_discourse_id: Uuid, discourse_post: &discourse_post::Model, priority: bool) -> Result<()> {
    info!("Updating revisions for post");

    for rev_num in 2..=discourse_post.version {
        let url = format!(
            "/posts/{}/revisions/{}.json",
            discourse_post.external_id, rev_num
        );
        info!(url, "Fetching revision");
        let mut revision: Revision = discourse_api
            .queue(&url, priority)
            .await
            .with_context(|| format!("Failed to fetch revision for post {}", discourse_post.id))?;

        // Process upload URLs in revision body content
        match process_upload_urls(
            &revision.body_changes.side_by_side_markdown,
            discourse_api.clone().into(),
        )
        .await
        {
            Ok(processed_content) => {
                revision.body_changes.side_by_side_markdown = processed_content;
            }
            Err(e) => {
                error!(
                    error = ?e,
                    post_id = discourse_post.id.to_string(),
                    revision_version = rev_num,
                    "Failed to process revision raw content"
                );
                // If processing fails, keep the original content.
            }
        }

        upsert_revision(&revision, dao_discourse_id, discourse_post.id)
            .await
            .with_context(|| {
                format!(
                    "Failed to upsert revision for post {}",
                    discourse_post.id.to_string()
                )
            })?;
    }

    info!("Finished updating revisions for post");
    Ok(())
}
