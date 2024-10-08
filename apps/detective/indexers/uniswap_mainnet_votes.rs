use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::uniswap_gov::{uniswap_gov::uniswap_gov, VoteCastFilter};
use ethers::{
    abi::Address,
    contract::LogMeta,
    providers::{Http, Middleware, Provider},
    utils::to_checksum,
};
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use std::sync::Arc;
use tracing::info;

pub struct UniswapMainnetVotesIndexer;

impl UniswapMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::UniswapMainnetProposals
    }
}

#[async_trait::async_trait]
impl Indexer for UniswapMainnetVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Uniswap Mainnet Votes");
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
            .as_u32() as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = "0x408ED6354d4973f66138C91495F2f2FCbd8724C3"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = uniswap_gov::new(address, eth_rpc.clone());

        let logs = gov_contract
            .vote_cast_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer, eth_rpc.clone())
            .await
            .context("bad votes")?;

        Ok((Vec::new(), votes, to_block))
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn get_votes(
    logs: Vec<(VoteCastFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
    rpc: Arc<Provider<Http>>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        let created_block_number = meta.block_number.as_u64();
        let created_block = rpc
            .get_block(meta.block_number)
            .await
            .context("rpc.getblock")?;
        let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            choice: Set(match log.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            voting_power: Set((log.votes.as_u128() as f64) / (10.0f64.powi(18))),
            reason: NotSet,
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            txid: Set(Some(format!("{:#x}", meta.transaction_hash))),
        })
    }

    Ok(votes)
}
