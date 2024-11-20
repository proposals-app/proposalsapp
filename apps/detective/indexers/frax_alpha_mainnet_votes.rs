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
use frax_alpha_gov::{VoteCast, VoteCastWithParams};
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{
    dao, dao_indexer,
    sea_orm_active_enums::{IndexerType, IndexerVariant},
    vote,
};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    frax_alpha_gov,
    "./abis/frax_alpha_gov.json"
);

pub struct FraxAlphaMainnetVotesIndexer;

impl FraxAlphaMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::FraxAlphaMainnetProposals
    }
}

#[async_trait]
impl Indexer for FraxAlphaMainnetVotesIndexer {
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

#[async_trait::async_trait]
impl VotesIndexer for FraxAlphaMainnetVotesIndexer {
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Frax Alpha Votes");

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

        let address = address!("e8Ab863E629a05c73D6a23b99d37027E3763156e");

        let gov_contract = frax_alpha_gov::new(address, eth_rpc.clone());

        let logs = gov_contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("bad query")?;

        let logs_with_params = gov_contract
            .VoteCastWithParams_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer, &eth_rpc.clone())
            .await
            .context("bad votes")?;

        let votes_with_params = get_votes_with_params(logs_with_params.clone(), indexer, &eth_rpc)
            .await
            .context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok(ProcessResult::Votes(all_votes, to_block))
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
            voting_power: Set((event.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
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

async fn get_votes_with_params(
    logs: Vec<(VoteCastWithParams, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
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

        let created_block_timestamp =
            DateTime::from_timestamp_millis(created_block_timestamp as i64 * 1000)
                .unwrap()
                .naive_utc();

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            voting_power: Set((event.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
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
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
            reason: Set(Some(event.reason)),
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod frax_alpha_mainnet_votes_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn frax_alpha_mainnet_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 18443982,
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

        match FraxAlphaMainnetVotesIndexer
            .process_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 18443982,
                    voter_address: "0xD105C6b9D574dC2D6b8C338D591401E9919C7F07",
                    choice: json!(0),
                    voting_power: 125541.86822203189,
                    reason: Some(""),
                    proposal_external_id: "5909113345317497261671190909945870222582022045673283684419546965696493954659",
                    time_created: Some(parse_datetime("2023-10-27 20:39:23")),
                    block_created: Some(18443982),
                    txid: Some(
                        "0x6798f025217e4551c326f2fc1e76a9966ffb3f483a5c1f78ef6cf29c973708ce",
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
