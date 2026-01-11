use super::Grouper;
use anyhow::Result;
use chrono::Utc;
use proposalsapp_db::models::*;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, sea_query};
use std::collections::{HashMap, HashSet};
use tracing::info;
use utils::types::ProposalGroupItem;
use uuid::Uuid;

impl Grouper {
    pub(super) async fn persist_results_optimized(
        &self,
        groups: &HashMap<Uuid, Vec<ProposalGroupItem>>,
        original_groups: &HashMap<Uuid, serde_json::Value>,
        existing_group_ids: &HashSet<Uuid>,
        dao_id: Uuid,
    ) -> Result<()> {
        let mut updated_count = 0;
        let mut created_count = 0;
        let mut skipped_count = 0;

        for (group_id, items) in groups.iter() {
            if items.is_empty() {
                continue;
            }

            let items_json = serde_json::to_value(items)?;

            let group_name = match &items[0] {
                ProposalGroupItem::Proposal(p) => p.name.clone(),
                ProposalGroupItem::Topic(t) => t.name.clone(),
            };

            if existing_group_ids.contains(group_id) {
                if let Some(original_items) = original_groups.get(group_id)
                    && &items_json == original_items
                {
                    skipped_count += 1;
                    continue;
                }

                proposal_group::Entity::update_many()
                    .filter(proposal_group::Column::Id.eq(*group_id))
                    .col_expr(
                        proposal_group::Column::Items,
                        sea_query::Expr::value(items_json),
                    )
                    .col_expr(
                        proposal_group::Column::Name,
                        sea_query::Expr::value(group_name),
                    )
                    .exec(&self.db)
                    .await?;
                updated_count += 1;
            } else {
                let new_group = proposal_group::ActiveModel {
                    id: Set(*group_id),
                    name: Set(group_name),
                    items: Set(items_json),
                    created_at: Set(Utc::now().naive_utc()),
                    dao_id: Set(dao_id),
                };

                new_group.insert(&self.db).await?;
                created_count += 1;
            }
        }

        info!(
            dao_id = %dao_id,
            updated = updated_count,
            created = created_count,
            skipped = skipped_count,
            "Persist results completed"
        );

        Ok(())
    }
}
