use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::frax_omega_gov::{
    frax_omega_gov::frax_omega_gov, VoteCastFilter, VoteCastWithParamsFilter,
};
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

pub struct FraxOmegaMainnetVotesIndexer;

impl FraxOmegaMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::FraxOmegaMainnetProposals
    }
}

#[async_trait::async_trait]
impl Indexer for FraxOmegaMainnetVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Frax Omega Votes");
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

        let address = "0x953791d7c5ac8ce5fb23bbbf88963da37a95fe7a"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = frax_omega_gov::new(address, eth_rpc.clone());

        let logs = gov_contract
            .vote_cast_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let logs_with_params = gov_contract
            .vote_cast_with_params_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer).context("bad votes")?;

        let votes_with_params =
            get_votes_with_params(logs_with_params.clone(), indexer).context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok((Vec::new(), all_votes, to_block))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

fn get_votes(
    logs: Vec<(VoteCastFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(log.reason)),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(meta.transaction_hash.as_bytes())
            ))),
            time_created: NotSet,
        })
    }

    Ok(votes)
}

fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParamsFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(meta.transaction_hash.as_bytes())
            ))),
            reason: NotSet,
            time_created: NotSet,
        })
    }

    Ok(votes)
}