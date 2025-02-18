use crate::{
    chain_data::{self},
    indexer::{Indexer, ProcessResult, VotesIndexer},
};
use aave_v3_voting_machine_avalanche::VoteEmitted;
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
};
use alloy_chains::NamedChain;
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use proposalsapp_db::models::{dao, dao_indexer, sea_orm_active_enums::IndexerVariant, vote};
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument};

pub struct AaveV3AvalancheVotesIndexer;

impl AaveV3AvalancheVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::AaveV3MainnetProposals
    }
}

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    aave_v3_voting_machine_avalanche,
    "./abis/aave_v3_voting_machine_avalanche.json"
);

#[async_trait]
impl Indexer for AaveV3AvalancheVotesIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::AaveV3AvalancheVotes
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait::async_trait]
impl VotesIndexer for AaveV3AvalancheVotesIndexer {
    #[instrument(skip_all)]
    async fn process_votes(&self, indexer: &dao_indexer::Model, _dao: &dao::Model) -> Result<ProcessResult> {
        info!("Processing Aave V3 Avalanche Votes");

        let ava_rpc = chain_data::get_chain_config(NamedChain::Avalanche)?
            .provider
            .clone();

        let current_block = ava_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("617332a777780F546261247F621051d0b98975Eb");

        let gov_contract = aave_v3_voting_machine_avalanche::new(address, ava_rpc.clone());

        let logs = gov_contract
            .VoteEmitted_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer, &ava_rpc)
            .await
            .context("bad votes")?;

        Ok(ProcessResult::Votes(votes, to_block))
    }
}

#[instrument(skip_all)]
async fn get_votes(logs: Vec<(VoteEmitted, Log)>, indexer: &dao_indexer::Model, rpc: &Arc<ReqwestProvider>) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteEmitted, Log)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (event, log) in voter_logs {
        let created_block_number = log.block_number.unwrap();
        let created_block_timestamp = rpc
            .get_block_by_number(
                log.block_number.unwrap().into(),
                BlockTransactionsKind::Hashes,
            )
            .await
            .context("get_block_by_number")?
            .unwrap()
            .header
            .timestamp;

        let created_block_timestamp = DateTime::from_timestamp_millis(created_block_timestamp as i64 * 1000)
            .unwrap()
            .naive_utc();

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            choice: Set(match event.support {
                true => 0.into(),
                false => 1.into(),
            }),
            voting_power: Set((event.votingPower.to::<u128>() as f64) / (10.0f64.powi(18))),
            reason: NotSet,
            block_created: Set(Some(created_block_number as i32)),
            created_at: Set(created_block_timestamp),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}
