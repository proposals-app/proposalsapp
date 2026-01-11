use super::Grouper;
use anyhow::{Context, Result};
use proposalsapp_db::models::*;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use tracing::warn;
use uuid::Uuid;

impl Grouper {
    pub(super) async fn load_proposals(&self, dao_id: Uuid) -> Result<Vec<proposal::Model>> {
        let governors = dao_governor::Entity::find()
            .filter(dao_governor::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await
            .context("Failed to load governors")?;

        let governor_ids: Vec<Uuid> = governors.into_iter().map(|g| g.id).collect();

        if governor_ids.is_empty() {
            return Ok(vec![]);
        }

        proposal::Entity::find()
            .filter(proposal::Column::GovernorId.is_in(governor_ids))
            .order_by_asc(proposal::Column::CreatedAt)
            .all(&self.db)
            .await
            .context("Failed to load proposals")
    }

    pub(super) async fn load_dao_discourse(
        &self,
        dao_id: Uuid,
    ) -> Result<Option<dao_discourse::Model>> {
        dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(dao_id))
            .one(&self.db)
            .await
            .context("Failed to load DAO discourse")
    }

    pub(super) async fn load_topics(
        &self,
        dao_slug: &str,
        dao_discourse: &dao_discourse::Model,
    ) -> Result<Vec<discourse_topic::Model>> {
        let category_filter = self
            .category_filters
            .get(dao_slug)
            .cloned()
            .unwrap_or_else(|| {
                warn!("No category filter configured for DAO: {}", dao_slug);
                vec![]
            });

        let mut query = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id))
            .filter(discourse_topic::Column::Closed.eq(false))
            .filter(discourse_topic::Column::Archived.eq(false))
            .filter(discourse_topic::Column::Visible.eq(true));

        if !category_filter.is_empty() {
            query = query.filter(discourse_topic::Column::CategoryId.is_in(category_filter));
        }

        query
            .order_by_asc(discourse_topic::Column::CreatedAt)
            .all(&self.db)
            .await
            .context("Failed to load discourse topics")
    }

    pub(super) async fn load_groups(&self, dao_id: Uuid) -> Result<Vec<proposal_group::Model>> {
        proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(dao_id))
            .all(&self.db)
            .await
            .context("Failed to load existing groups")
    }
}
