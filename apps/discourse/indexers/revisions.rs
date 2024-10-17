use crate::api_handler::ApiHandler;
use crate::db_handler::DbHandler;
use crate::models::revisions::Revision;
use anyhow::Result;
use chrono::{Duration, Utc};
use sea_orm::prelude::Uuid;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use seaorm::discourse_post;
use std::sync::Arc;
use tokio::task::JoinSet;
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
        let mut join_set = JoinSet::new();

        for post in posts {
            let db_handler = db_handler.clone();
            let api_handler = self.api_handler.clone();
            join_set.spawn(async move {
                if let Err(e) = update_revisions_for_post(
                    &api_handler,
                    db_handler,
                    dao_discourse_id,
                    post.external_id,
                    post.version,
                )
                .await
                {
                    eprintln!(
                        "Error updating revisions for post {}: {:?}",
                        post.external_id, e
                    );
                }
            });
        }

        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                eprintln!("Error in revision tasks: {:?}", e);
            }
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
        let mut join_set = JoinSet::new();

        for post in posts {
            let db_handler = db_handler.clone();
            let api_handler = self.api_handler.clone();
            join_set.spawn(async move {
                if let Err(e) = update_revisions_for_post(
                    &api_handler,
                    db_handler,
                    dao_discourse_id,
                    post.external_id,
                    post.version,
                )
                .await
                {
                    eprintln!(
                        "Error updating revisions for post {}: {:?}",
                        post.external_id, e
                    );
                }
            });
        }

        while let Some(result) = join_set.join_next().await {
            if let Err(e) = result {
                eprintln!("Error in revision tasks: {:?}", e);
            }
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
            .filter(discourse_post::Column::CanViewEditHistory.gte(true))
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
            .filter(discourse_post::Column::CanViewEditHistory.gte(true))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .filter(seaorm::discourse_post::Column::UpdatedAt.gte(six_hours_ago.naive_utc()))
            .all(&db_handler.conn)
            .await?)
    }
}

async fn update_revisions_for_post(
    api_handler: &ApiHandler,
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
        let revision: Revision = api_handler.fetch(&url).await?;

        db_handler
            .upsert_revision(&revision, dao_discourse_id, discourse_post.id)
            .await?;
    }

    Ok(())
}
