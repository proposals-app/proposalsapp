use crate::{indexer::Indexer, rpc_providers};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
};
use anyhow::{Context, Result};
use chrono::DateTime;
use maker_poll_vote::Voted;
use num_bigint::BigInt;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use std::{str::FromStr, sync::Arc};
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    maker_poll_vote,
    "./abis/maker_poll_vote.json"
);

pub struct MakerPollMainnetVotesIndexer;

impl MakerPollMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::MakerPollMainnetProposals
    }
}

#[async_trait::async_trait]
impl Indexer for MakerPollMainnetVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Maker Poll Votes");

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

        let address = address!("D3A9FE267852281a1e6307a1C37CDfD76d39b133");

        let gov_contract = maker_poll_vote::new(address, eth_rpc.clone());

        let logs = gov_contract
            .Voted_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let votes = get_votes(logs.clone(), indexer, &eth_rpc.clone())
            .await
            .context("bad votes")?;

        Ok((Vec::new(), votes, to_block))
    }

    fn min_refresh_speed(&self) -> i32 {
        1
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn get_votes(
    logs: Vec<(Voted, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(Voted, Log)> = logs.into_iter().collect();

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
        let options = get_options(event.optionId.to_string()).await?;

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            voting_power: Set(0.into()),
            block_created: Set(Some(created_block_number as i32)),
            choice: Set(options.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(event.pollId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            time_created: Set(Some(created_block_timestamp)),
            reason: NotSet,
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}

async fn get_options(raw_option: String) -> Result<Vec<u8>> {
    enum Endian {
        Big,
    }

    struct ToBufferOptions {
        endian: Endian,
        size: usize,
    }

    impl Default for ToBufferOptions {
        fn default() -> Self {
            ToBufferOptions {
                endian: Endian::Big,
                size: 1,
            }
        }
    }

    let opts = ToBufferOptions::default();
    let num = BigInt::from_str(&raw_option).context("Invalid input")?;

    let mut hex = num.to_bytes_be().1;
    if hex.len() % opts.size != 0 {
        let padding = opts.size - (hex.len() % opts.size);
        let mut padded_hex = vec![0; padding];
        padded_hex.append(&mut hex);
        hex = padded_hex;
    }

    let mut buf = Vec::new();

    for chunk in hex.chunks(opts.size) {
        match opts.endian {
            Endian::Big => buf.extend_from_slice(chunk),
        }
    }

    Ok(buf)
}

#[cfg(test)]
mod maker_poll_mainnet_votes {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn maker_poll_mainnet_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 20322121,
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

        match MakerPollMainnetVotesIndexer.process(&indexer, &dao).await {
            Ok((_, votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 20322121,
                    voter_address: "0x73fA019C419CcEa5Cd1b7F79C8d161954B73FCdf",
                    choice: json!([1]),
                    voting_power: 0.0,
                    reason: None,
                    proposal_external_id: "1124",
                    time_created: Some(parse_datetime("2024-07-16 22:40:11")),
                    block_created: Some(20322121),
                    txid: Some(
                        "0x13b3facd9af85b508d060550ca15b62ec9507096369b1fd290837d0f43afcd7b",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
