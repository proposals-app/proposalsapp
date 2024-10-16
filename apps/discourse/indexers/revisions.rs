use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::models::revisions::{Revision, RevisionResponse};
use anyhow::Result;
use chrono::{Duration, Utc};
use sea_orm::prelude::Uuid;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use seaorm::discourse_post;
use std::sync::Arc;
use tracing::{instrument, warn};

pub struct RevisionIndexer {
    api_handler: Arc<ApiHandler>,
}

impl RevisionIndexer {
    pub fn new(api_handler: Arc<ApiHandler>) -> Self {
        Self { api_handler }
    }

    #[instrument(skip(self, db_handler), fields(dao_discourse_id = %dao_discourse_id))]
    pub async fn update_all_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<()> {
        let posts = self
            .fetch_posts_with_revisions(db_handler.clone(), dao_discourse_id)
            .await?;

        for post in posts {
            self.update_revisions_for_post(
                db_handler.clone(),
                dao_discourse_id,
                post.external_id,
                post.version,
            )
            .await?;
        }

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
            .await?;

        for post in posts {
            self.update_revisions_for_post(
                db_handler.clone(),
                dao_discourse_id,
                post.external_id,
                post.version,
            )
            .await?;
        }

        Ok(())
    }

    async fn update_revisions_for_post(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
        post_id: i32,
        version: i32,
    ) -> Result<()> {
        let discourse_post = seaorm::discourse_post::Entity::find()
            .filter(seaorm::discourse_post::Column::ExternalId.eq(post_id))
            .filter(seaorm::discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(&db_handler.conn)
            .await?;

        let discourse_post = match discourse_post {
            Some(post) => post,
            None => {
                warn!("Discourse post not found for external_id: {} and dao_discourse_id: {}. Skipping revisions.", post_id, dao_discourse_id);
                return Ok(());
            }
        };

        for rev_num in 2..=version {
            let url = format!("/posts/{}/revisions/{}.json", post_id, rev_num);
            let response: RevisionResponse = self.api_handler.fetch(&url).await?;

            let revision = Revision {
                id: response.current_revision,
                post_id: response.post_id,
                version: response.current_version,
                created_at: response.created_at,
                username: response.username,
                body_changes: response.body_changes.inline,
                edit_reason: response.edit_reason,
            };

            db_handler
                .upsert_revision(&revision, dao_discourse_id, discourse_post.id)
                .await?;
        }

        Ok(())
    }

    async fn fetch_posts_with_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<Vec<discourse_post::Model>> {
        Ok(discourse_post::Entity::find()
            .filter(discourse_post::Column::Version.gte(2))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .all(&db_handler.conn)
            .await?)
    }

    async fn fetch_recent_posts_with_revisions(
        &self,
        db_handler: Arc<DbHandler>,
        dao_discourse_id: Uuid,
    ) -> Result<Vec<seaorm::discourse_post::Model>> {
        let six_hours_ago = Utc::now() - Duration::hours(6);
        Ok(seaorm::discourse_post::Entity::find()
            .filter(discourse_post::Column::Version.gte(2))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .filter(seaorm::discourse_post::Column::UpdatedAt.gte(six_hours_ago.naive_utc()))
            .all(&db_handler.conn)
            .await?)
    }
}
