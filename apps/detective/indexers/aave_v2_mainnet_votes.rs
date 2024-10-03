use crate::Indexer;
use anyhow::Result;
use seaorm::{dao_indexer, proposal, vote};

pub struct AaveV2MainnetVotesIndexer;

#[async_trait::async_trait]
impl Indexer for AaveV2MainnetVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>)> {
        println!("Processing Aave V2 Mainnet Votes");
        // Implement Aave V2 Mainnet Votes indexing logic
        // Fetch votes from the Aave V2 Mainnet
        // Create vote::ActiveModel instances
        // Store votes using database::store_votes function
        Ok((Vec::new(), Vec::new()))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}
