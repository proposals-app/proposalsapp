use crate::{
    indexer::{Indexer, ProcessResult, VotesIndexer},
    rpc_providers,
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use compound_gov::VoteCast;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::sea_orm_active_enums::IndexerType;
use seaorm::{dao, dao_indexer, sea_orm_active_enums::IndexerVariant, vote};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    compound_gov,
    "./abis/compound_gov.json"
);

pub struct CompoundMainnetVotesIndexer;

impl CompoundMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::CompoundMainnetProposals
    }
}

#[async_trait]
impl Indexer for CompoundMainnetVotesIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Votes
    }
}

#[async_trait]
impl VotesIndexer for CompoundMainnetVotesIndexer {
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Compound Votes");

        let eth_rpc = rpc_providers::get_provider("ethereum")?;

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("c0Da02939E1441F497fd74F78cE7Decb17B66529");

        let gov_contract = compound_gov::new(address, eth_rpc.clone());

        let logs = gov_contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let votes = get_votes(logs.clone(), indexer, &eth_rpc)
            .await
            .context("bad votes")?;

        Ok(ProcessResult::Votes(votes, to_block))
    }
}

async fn get_votes(
    logs: Vec<(VoteCast, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCast, Log)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (event, log) in voter_logs {
        let created_block_number = log.block_number.unwrap();
        let created_block_timestamp = rpc
            .get_block_by_number(log.block_number.unwrap().into(), false)
            .await
            .context("get_block_by_number")?
            .unwrap()
            .header
            .timestamp;

        let created_block_timestamp =
            DateTime::from_timestamp_millis(created_block_timestamp as i64 * 1000)
                .unwrap()
                .naive_utc();

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            choice: Set(match event.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            voting_power: Set((event.votes.to::<u128>() as f64) / (10.0f64.powi(18))),
            reason: NotSet,
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
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

#[cfg(test)]
mod compound_mainnet_votes {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn compound_mainnet_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 20958429,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
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

        match CompoundMainnetVotesIndexer
            .process_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 20958429,
                    voter_address: "0x17296956b4E07Ff8931E4ff4eA06709FaB70b879",
                    choice: json!(0),
                    voting_power: 1.0,
                    reason: None,
                    proposal_external_id: "346",
                    time_created: Some(parse_datetime("2024-10-13 18:25:47")),
                    block_created: Some(20958429),
                    txid: Some(
                        "0xdcbbf2f67d04c42b9c93bc2c74262e77a7d710f55a9eeb39f778b7ab389f8768",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
