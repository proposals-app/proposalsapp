use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, VotesIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use gitcoin_v1_gov::VoteCast;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{
    dao, dao_indexer,
    sea_orm_active_enums::{IndexerType, IndexerVariant},
    vote,
};
use std::{sync::Arc, time::Duration};
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    gitcoin_v1_gov,
    "./abis/gitcoin_v1_gov.json"
);

pub struct GitcoinV1MainnetVotesIndexer;

impl GitcoinV1MainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::GitcoinMainnetProposals
    }
}

#[async_trait]
impl Indexer for GitcoinV1MainnetVotesIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Votes
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl VotesIndexer for GitcoinV1MainnetVotesIndexer {
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Gitcoin V1 Votes");

        let eth_rpc = chain_data::get_chain_config(Chain::Ethereum)?
            .provider
            .clone();

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

        let address = address!("DbD27635A534A3d3169Ef0498beB56Fb9c937489");

        let gov_contract = gitcoin_v1_gov::new(address, eth_rpc.clone());

        let logs = gov_contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer, &eth_rpc.clone())
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
            .get_block_by_number(
                log.block_number.unwrap().into(),
                BlockTransactionsKind::Hashes,
            )
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
            voting_power: Set((event.votes.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
            choice: Set(match event.support {
                true => 0.into(),
                false => 1.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
            reason: NotSet,
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod gitcoin_v1_mainnet_votes_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn gitcoin_v1_mainnet_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 17917788,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
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

        match GitcoinV1MainnetVotesIndexer
            .process_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 17917788,
                    voter_address: "0x6F0c3105444e9Ad288ed64674C12420593A1Efb2",
                    choice: json!(0),
                    voting_power: 13.23564870882459,
                    reason: None,
                    proposal_external_id: "66",
                    time_created: Some(parse_datetime("2023-08-15 04:13:59")),
                    block_created: Some(17917788),
                    txid: Some(
                        "0xa3a730ae9e76091b9583b7f260e844d4686015dc5379c8982ba40f754bb6e73d",
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
