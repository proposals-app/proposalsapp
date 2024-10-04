use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::aave_v_2_gov::{aave_v2_gov, VoteEmittedFilter};
use ethers::{
    abi::Address,
    contract::LogMeta,
    providers::{Http, Middleware, Provider},
    utils::to_checksum,
};
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao_indexer, proposal, vote};
use std::sync::Arc;

pub struct AaveV2MainnetVotesIndexer;

#[async_trait::async_trait]
impl Indexer for AaveV2MainnetVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>)> {
        println!("Processing Aave V2 Mainnet Votes");
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
            .as_u64();

        let from_block = indexer.index as u64;
        let to_block = if indexer.index as u64 + indexer.speed as u64 > current_block {
            current_block
        } else {
            indexer.index as u64 + indexer.speed as u64
        };

        let address = "0xEC568fffba86c094cf06b22134B23074DFE2252c"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = aave_v2_gov::new(address, eth_rpc);

        let logs = gov_contract
            .vote_emitted_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer).context("bad votes")?;
        Ok((Vec::new(), votes))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

fn get_votes(
    logs: Vec<(VoteEmittedFilter, LogMeta)>,
    dao_indexer: &dao_indexer::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteEmittedFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.voting_power.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                true => 0.into(),
                false => 1.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.id.to_string()),
            dao_id: Set(dao_indexer.dao_id),
            indexer_id: Set(dao_indexer.id),
            ..Default::default()
        })
    }

    Ok(votes)
}
