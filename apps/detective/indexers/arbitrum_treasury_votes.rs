use crate::{
    chain_data::{self},
    indexer::{Indexer, ProcessResult, VotesIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
};
use alloy_chains::NamedChain;
use anyhow::{Context, Result};
use arbitrum_treasury_gov::{VoteCast, VoteCastWithParams};
use async_trait::async_trait;
use chrono::DateTime;
use proposalsapp_db::models::{dao, dao_indexer, sea_orm_active_enums::IndexerVariant, vote};
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_treasury_gov,
    "./abis/arbitrum_treasury_gov.json"
);

pub struct ArbitrumTreasuryVotesIndexer;

impl ArbitrumTreasuryVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::ArbTreasuryArbitrumProposals
    }
}

#[async_trait]
impl Indexer for ArbitrumTreasuryVotesIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::ArbTreasuryArbitrumVotes
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl VotesIndexer for ArbitrumTreasuryVotesIndexer {
    #[instrument(skip_all)]
    async fn process_votes(&self, indexer: &dao_indexer::Model, _dao: &dao::Model) -> Result<ProcessResult> {
        info!("Processing Arbitrum Treasury Votes");

        let arb_rpc = chain_data::get_chain_config(NamedChain::Arbitrum)?
            .provider
            .clone();

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("789fC99093B09aD01C34DC7251D0C89ce743e5a4");

        let gov_contract = arbitrum_treasury_gov::new(address, arb_rpc.clone());

        let logs = gov_contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let logs_with_params = gov_contract
            .VoteCastWithParams_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let votes = get_votes(logs.clone(), indexer, &arb_rpc.clone())
            .await
            .context("bad votes")?;

        let votes_with_params = get_votes_with_params(logs_with_params.clone(), indexer, &arb_rpc.clone())
            .await
            .context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok(ProcessResult::Votes(all_votes, to_block))
    }
}

#[instrument(skip_all)]
async fn get_votes(logs: Vec<(VoteCast, Log)>, indexer: &dao_indexer::Model, rpc: &Arc<ReqwestProvider>) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCast, Log)> = logs.into_iter().collect();

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
            voting_power: Set((event.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            created_at: Set(created_block_timestamp),
            choice: Set(match event.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(event.reason)),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}

#[instrument(skip_all)]
async fn get_votes_with_params(logs: Vec<(VoteCastWithParams, Log)>, indexer: &dao_indexer::Model, rpc: &Arc<ReqwestProvider>) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParams, Log)> = logs.into_iter().collect();

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
            voting_power: Set((event.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            created_at: Set(created_block_timestamp),
            choice: Set(match event.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(event.reason)),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod arbitrum_treasury_votes_tests {
    use super::*;
    use dotenv::dotenv;
    use proposalsapp_db::models::sea_orm_active_enums::{IndexerType, IndexerVariant};
    use sea_orm::prelude::Uuid;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn arbitrum_treasury_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 217114670,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match ArbitrumTreasuryVotesIndexer
            .process_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 217114670,
                    voter_address: "0xE594469fDe6AE29943a64f81d95c20F5F8eB2e04",
                    choice: json!(1),
                    voting_power: 0.0,
                    reason: Some("fuck this"),
                    proposal_external_id: "53472400873981607449547539050199074000442490831067826984987297151333310022877",
                    time_created: Some(parse_datetime("2024-06-01 00:48:24")),
                    block_created: Some(217114670),
                    txid: Some("0x124a6d5e84a82f586c22db233d32fae9ddaa436969685db5d2fcc99681d35008"),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
