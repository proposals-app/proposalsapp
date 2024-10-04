use anyhow::Result;
use async_trait::async_trait;
use seaorm::{dao_indexer, proposal, vote};

#[async_trait]
pub trait Indexer: Send + Sync {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
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
}

pub enum IndexerImpl {
    AaveV2MainnetProposals(
        crate::indexers::aave_v2_mainnet_proposals::AaveV2MainnetProposalsIndexer,
    ),
    AaveV2MainnetVotes(crate::indexers::aave_v2_mainnet_votes::AaveV2MainnetVotesIndexer),
    // Add other variants as needed
}

#[async_trait]
impl Indexer for IndexerImpl {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>)> {
        match self {
            IndexerImpl::AaveV2MainnetProposals(i) => i.process(indexer).await,
            IndexerImpl::AaveV2MainnetVotes(i) => i.process(indexer).await,
            // Add other matches as needed
        }
    }

    fn min_refresh_speed(&self) -> i32 {
        match self {
            IndexerImpl::AaveV2MainnetProposals(i) => i.min_refresh_speed(),
            IndexerImpl::AaveV2MainnetVotes(i) => i.min_refresh_speed(),
            // Add other matches as needed
        }
    }

    fn max_refresh_speed(&self) -> i32 {
        match self {
            IndexerImpl::AaveV2MainnetProposals(i) => i.max_refresh_speed(),
            IndexerImpl::AaveV2MainnetVotes(i) => i.max_refresh_speed(),
            // Add other matches as needed
        }
    }
}
