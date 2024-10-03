use anyhow::Result;
use itertools::Itertools;
use sea_orm::{ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter, Set};
use seaorm::{
    dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
    vote,
};
use std::collections::HashSet;
use tracing::info;

#[async_trait::async_trait]
pub trait Indexer: Send + Sync {
    async fn process(
        &self,
        indexer: &seaorm::dao_indexer::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>)>;

    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;

    fn adjust_speed(&self, current_speed: i32, success: bool) -> i32 {
        if success {
            std::cmp::min(current_speed * 5 / 4, self.max_refresh_speed())
        } else {
            std::cmp::max(current_speed * 3 / 4, self.min_refresh_speed())
        }
    }

    async fn store_proposals(
        &self,
        proposals: Vec<proposal::ActiveModel>,
        db: &DatabaseConnection,
    ) -> Result<()> {
        let mut proposals_to_insert = vec![];
        let mut insert_ids_unique = HashSet::new();

        for proposal in proposals.iter().cloned() {
            let existing_proposal = proposal::Entity::find()
                .filter(
                    Condition::all()
                        .add(proposal::Column::ExternalId.eq(proposal.external_id.clone().take()))
                        .add(
                            proposal::Column::DaoIndexerId
                                .eq(proposal.dao_indexer_id.clone().take()),
                        ),
                )
                .one(db)
                .await?;

            if let Some(existing) = existing_proposal {
                let mut updated_proposal = proposal.clone();
                updated_proposal.id = Set(existing.id);

                proposal::Entity::update(updated_proposal.clone())
                    .exec(db)
                    .await?;
            } else if insert_ids_unique.insert(proposal.external_id.clone().take()) {
                proposals_to_insert.push(proposal);
            }
        }

        if !proposals_to_insert.is_empty() {
            proposal::Entity::insert_many(proposals_to_insert)
                .on_empty_do_nothing()
                .exec(db)
                .await?;
        }

        Ok(())
    }

    async fn update_index(
        proposals: &[proposal::ActiveModel],
        indexer: &dao_indexer::Model,
        to_index: Option<i32>,
        db: &DatabaseConnection,
    ) -> Result<i32> {
        let mut new_index = to_index.unwrap_or(indexer.index + indexer.speed);

        let sorted_proposals = proposals
            .iter()
            .sorted_by(|a, b| a.index_created.as_ref().cmp(b.index_created.as_ref()))
            .collect_vec();

        for proposal in sorted_proposals.iter() {
            if proposal.proposal_state.as_ref() == &ProposalState::Active
                || (proposal.proposal_state.as_ref() == &ProposalState::Pending
                    && indexer.indexer_variant == IndexerVariant::SnapshotProposals)
                    && proposal.index_created.is_set()
                    && proposal.index_created.clone().unwrap() < new_index
            {
                new_index = proposal.index_created.clone().unwrap();
                break;
            }
        }

        dao_indexer::Entity::update(dao_indexer::ActiveModel {
            id: Set(indexer.id),
            index: Set(new_index),
            ..Default::default()
        })
        .exec(db)
        .await?;

        info!(
            indexer_id = %indexer.id,
            new_index,
            "Index updated successfully"
        );

        Ok(new_index)
    }
}
