use crate::{db_handler::DbHandler, discourse_api::DiscourseApi, models::revisions::Revision};
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use sea_orm::{prelude::Uuid, ColumnTrait, EntityTrait, QueryFilter};
use seaorm::{discourse_post, discourse_post_revision};
use std::sync::Arc;
use tokio::task::JoinSet;
use tracing::{error, info, instrument, warn};

pub struct RevisionIndexer {
    discourse_api: Arc<DiscourseApi>,
}

impl RevisionIndexer {
    pub fn new(discourse_api: Arc<DiscourseApi>) -> Self {
        Self { discourse_api }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let posts = self
            .fetch_posts_with_revisions(db_handler.clone(), dao_discourse_id)
            .await
            .context("Failed to fetch posts with revisions")?;
        let mut join_set = JoinSet::new();

        for post in posts {
            let db_handler = db_handler.clone();
            let api_handler = self.discourse_api.clone();
            join_set.spawn(async move {
                if let Err(e) = update_revisions_for_post(
                    &api_handler,
                    db_handler,
                    dao_discourse_id,
                    post.external_id,
                    post.version,
                    false,
                )
                .await
                {
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

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_recent_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let posts = self
            .fetch_recent_posts_with_revisions(db_handler.clone(), dao_discourse_id)
            .await
            .context("Failed to fetch recent posts with revisions")?;
        let mut join_set = JoinSet::new();

        for post in posts {
            let db_handler = db_handler.clone();
            let api_handler = self.discourse_api.clone();
            join_set.spawn(async move {
                if let Err(e) = update_revisions_for_post(
                    &api_handler,
                    db_handler,
                    dao_discourse_id,
                    post.external_id,
                    post.version,
                    true,
                )
                .await
                {
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

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    async fn fetch_posts_with_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<Vec<discourse_post::Model>> {
        let posts = discourse_post::Entity::find()
            .filter(discourse_post::Column::Version.gt(1))
            .filter(discourse_post::Column::CanViewEditHistory.eq(true))
            .filter(discourse_post::Column::Deleted.eq(false))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .find_with_related(discourse_post_revision::Entity)
            .all(&db_handler.conn)
            .await
            .context("Failed to fetch posts with revisions")?;

        let filtered_posts: Vec<discourse_post::Model> = posts
            .into_iter()
            .filter(|(post, revisions)| {
                let revision_count = revisions.len();
                revision_count < (post.version - 1) as usize
            })
            .map(|(post, _)| post)
            .collect();

        info!(
            posts_count = filtered_posts.len(),
            "Fetched posts with incomplete revisions"
        );
        Ok(filtered_posts)
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    async fn fetch_recent_posts_with_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<Vec<seaorm::discourse_post::Model>> {
        let six_hours_ago = Utc::now() - Duration::hours(6);
        let posts = seaorm::discourse_post::Entity::find()
            .filter(discourse_post::Column::Version.gt(1))
            .filter(discourse_post::Column::CanViewEditHistory.eq(true))
            .filter(discourse_post::Column::Deleted.eq(false))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .filter(seaorm::discourse_post::Column::UpdatedAt.gte(six_hours_ago.naive_utc()))
            .find_with_related(discourse_post_revision::Entity)
            .all(&db_handler.conn)
            .await
            .context("Failed to fetch recent posts with revisions")?;

        let filtered_posts: Vec<seaorm::discourse_post::Model> = posts
            .into_iter()
            .filter(|(post, revisions)| {
                let revision_count = revisions.len();
                revision_count < (post.version - 1) as usize
            })
            .map(|(post, _)| post)
            .collect();

        info!(
            posts_count = filtered_posts.len(),
            "Fetched recent posts with incomplete revisions"
        );
        Ok(filtered_posts)
    }
}

#[instrument(skip(discourse_api, db_handler), fields(post_id = %post_id, dao_discourse_id = %dao_discourse_id))]
async fn update_revisions_for_post(
    discourse_api: &DiscourseApi,
    db_handler: Arc<DbHandler>,
    dao_discourse_id: Uuid,
    post_id: i32,
    version: i32,
    priority: bool,
) -> Result<()> {
    let discourse_post = seaorm::discourse_post::Entity::find()
        .filter(seaorm::discourse_post::Column::ExternalId.eq(post_id))
        .filter(seaorm::discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
        .one(&db_handler.conn)
        .await
        .context("Failed to fetch discourse post")?;

    let discourse_post = match discourse_post {
        Some(post) => post,
        None => {
            warn!(
                post_id = post_id.to_string(),
                dao_discourse_id = dao_discourse_id.to_string(),
                "Discourse post not found. Skipping revisions."
            );
            return Ok(());
        }
    };

    for rev_num in 2..=version {
        let url = format!("/posts/{}/revisions/{}.json", post_id, rev_num);
        info!(url, "Fetching revision");
        let revision: Revision = discourse_api
            .fetch(&url, priority)
            .await
            .with_context(|| format!("Failed to fetch revision for post {}", post_id))?;

        db_handler
            .upsert_revision(&revision, dao_discourse_id, discourse_post.id)
            .await
            .with_context(|| format!("Failed to upsert revision for post {}", post_id))?;
    }

    Ok(())
}
