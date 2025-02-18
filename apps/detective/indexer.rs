use anyhow::Result;
use async_trait::async_trait;
use proposalsapp_db::models::{dao, dao_indexer, delegation, proposal, sea_orm_active_enums::IndexerVariant, vote, voting_power};
use std::time::Duration;

#[async_trait]
pub trait Indexer: Send + Sync {
    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;
    fn indexer_variant(&self) -> IndexerVariant;
    fn timeout(&self) -> Duration;

    fn refresh_interval(&self) -> Duration {
        match self.indexer_variant() {
            IndexerVariant::AaveV2MainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::AaveV2MainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::AaveV3AvalancheVotes => Duration::from_secs(5 * 60),
            IndexerVariant::AaveV3MainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::AaveV3MainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::AaveV3PolygonVotes => Duration::from_secs(5 * 60),
            IndexerVariant::ArbitrumCouncilElections => Duration::from_secs(5 * 60),
            IndexerVariant::ArbitrumCouncilNominations => Duration::from_secs(5 * 60),
            IndexerVariant::ArbArbitrumDelegation => Duration::from_secs(5 * 60),
            IndexerVariant::ArbArbitrumVotingPower => Duration::from_secs(5 * 60),
            IndexerVariant::ArbCoreArbitrumProposals => Duration::from_secs(5 * 60),
            IndexerVariant::ArbCoreArbitrumVotes => Duration::from_secs(5 * 60),
            IndexerVariant::ArbTreasuryArbitrumProposals => Duration::from_secs(5 * 60),
            IndexerVariant::ArbTreasuryArbitrumVotes => Duration::from_secs(5 * 60),
            IndexerVariant::CompoundMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::CompoundMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::DydxMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::DydxMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::EnsMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::EnsMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::FraxAlphaMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::FraxAlphaMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::FraxOmegaMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::FraxOmegaMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::GitcoinMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::GitcoinMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::GitcoinV2MainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::GitcoinV2MainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::HopMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::HopMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::MakerExecutiveMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::MakerExecutiveMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::MakerPollArbitrumVotes => Duration::from_secs(5 * 60),
            IndexerVariant::MakerPollMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::MakerPollMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::NounsProposalsMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::NounsProposalsMainnetVotes => Duration::from_secs(5 * 60),
            IndexerVariant::OpOptimismProposals => Duration::from_secs(5 * 60),
            IndexerVariant::OpOptimismVotes => Duration::from_secs(5 * 60),
            IndexerVariant::SnapshotProposals => Duration::from_secs(5 * 60),
            IndexerVariant::SnapshotVotes => Duration::from_secs(60),
            IndexerVariant::UniswapMainnetProposals => Duration::from_secs(5 * 60),
            IndexerVariant::UniswapMainnetVotes => Duration::from_secs(5 * 60),
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
    async fn process_proposals(&self, indexer: &dao_indexer::Model, dao: &dao::Model) -> Result<ProcessResult>;
}

#[async_trait]
pub trait VotesIndexer: Indexer {
    async fn process_votes(&self, indexer: &dao_indexer::Model, dao: &dao::Model) -> Result<ProcessResult>;
}

#[async_trait]
pub trait ProposalsAndVotesIndexer: Indexer {
    async fn process_proposals_and_votes(&self, indexer: &dao_indexer::Model, dao: &dao::Model) -> Result<ProcessResult>;
}

#[async_trait]
pub trait VotingPowerIndexer: Indexer {
    async fn process_voting_powers(&self, indexer: &dao_indexer::Model, dao: &dao::Model) -> Result<ProcessResult>;
}

#[async_trait]
pub trait DelegationIndexer: Indexer {
    async fn process_delegations(&self, indexer: &dao_indexer::Model, dao: &dao::Model) -> Result<ProcessResult>;
}

pub enum ProcessResult {
    Proposals(Vec<proposal::ActiveModel>, i32),
    Votes(Vec<vote::ActiveModel>, i32),
    ProposalsAndVotes(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32),
    VotingPower(Vec<voting_power::ActiveModel>, i32),
    Delegation(Vec<delegation::ActiveModel>, i32),
}
