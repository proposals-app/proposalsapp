use anyhow::Result;
use async_trait::async_trait;
use seaorm::{
    dao, dao_indexer, delegation, proposal, sea_orm_active_enums::IndexerType, vote, voting_power,
};
use std::time::Duration;

#[async_trait]
pub trait Indexer: Send + Sync {
    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;
    fn indexer_type(&self) -> IndexerType;
    fn timeout(&self) -> Duration;

    fn refresh_interval(&self) -> Duration {
        match self.indexer_type() {
            IndexerType::Proposals => Duration::from_secs(5 * 60),
            IndexerType::Votes => Duration::from_secs(5 * 60),
            IndexerType::ProposalsAndVotes => Duration::from_secs(5 * 60),
            IndexerType::VotingPower => Duration::from_secs(60),
            IndexerType::Delegation => Duration::from_secs(60),
        }
    }

    fn adjust_speed(&self, current_speed: i32, success: bool) -> i32 {
        if success {
            // Increase by 10%, but at least by 1
            let increase = std::cmp::max((current_speed as f32 * 0.1).round() as i32, 1);
            let new_speed = current_speed + increase;
            std::cmp::min(new_speed, self.max_refresh_speed())
        } else {
            // Decrease by 50%
            let new_speed = current_speed / 2;
            std::cmp::max(new_speed, self.min_refresh_speed())
        }
    }
}

#[async_trait]
pub trait ProposalsIndexer: Indexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<ProcessResult>;
}

#[async_trait]
pub trait VotesIndexer: Indexer {
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<ProcessResult>;
}

#[async_trait]
pub trait ProposalsAndVotesIndexer: Indexer {
    async fn process_proposals_and_votes(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<ProcessResult>;
}

#[async_trait]
pub trait VotingPowerIndexer: Indexer {
    async fn process_voting_powers(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<ProcessResult>;
}

#[async_trait]
pub trait DelegationIndexer: Indexer {
    async fn process_delegations(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<ProcessResult>;
}

pub enum ProcessResult {
    Proposals(Vec<proposal::ActiveModel>, i32),
    Votes(Vec<vote::ActiveModel>, i32),
    ProposalsAndVotes(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32),
    VotingPower(Vec<voting_power::ActiveModel>, i32),
    Delegation(Vec<delegation::ActiveModel>, i32),
}
