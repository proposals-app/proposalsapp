use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::arbitrum_treasury_gov::{
    arbitrum_treasury_gov::arbitrum_treasury_gov, VoteCastFilter, VoteCastWithParamsFilter,
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

pub struct ArbitrumTreasuryVotesIndexer;

impl ArbitrumTreasuryVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::ArbTreasuryArbitrumProposals
    }
}

#[async_trait::async_trait]
impl Indexer for ArbitrumTreasuryVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Arbitrum Treasury Votes");
        let arb_rpc_url = std::env::var("ARBITRUM_NODE_URL").expect("Arbitrum node not set!");
        let arb_rpc = Arc::new(Provider::<Http>::try_from(arb_rpc_url).unwrap());

        let current_block = arb_rpc
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

        let address = "0x789fC99093B09aD01C34DC7251D0C89ce743e5a4"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = arbitrum_treasury_gov::new(address, arb_rpc.clone());

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

        let votes = get_votes(logs.clone(), indexer, arb_rpc.clone())
            .await
            .context("bad votes")?;

        let votes_with_params =
            get_votes_with_params(logs_with_params.clone(), indexer, arb_rpc.clone())
                .await
                .context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok((Vec::new(), all_votes, to_block))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
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
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
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
        })
    }

    Ok(votes)
}

async fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
    rpc: Arc<Provider<Http>>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParamsFilter, LogMeta)> = logs.into_iter().collect();

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
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
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
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod arbitrum_treasury_votes {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn arbitrum_treasury_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 217114670,
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

        match ArbitrumTreasuryVotesIndexer.process(&indexer, &dao).await {
            Ok((_, votes, _)) => {
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
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
