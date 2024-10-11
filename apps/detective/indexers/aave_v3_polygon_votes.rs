use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::aave_v_3_voting_machine_polygon::{
    aave_v3_voting_machine_polygon, VoteEmittedFilter,
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

pub struct AaveV3PolygonVotesIndexer;

impl AaveV3PolygonVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::AaveV3MainnetProposals
    }
}

#[async_trait::async_trait]
impl Indexer for AaveV3PolygonVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Aave V3 Polygon Votes");
        let poly_rpc_url = std::env::var("POLYGON_NODE_URL").expect("Polygon node not set!");
        let poly_rpc = Arc::new(Provider::<Http>::try_from(poly_rpc_url).unwrap());

        let current_block = poly_rpc
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

        let address = "0xc8a2ADC4261c6b669CdFf69E717E77C9cFeB420d"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = aave_v3_voting_machine_polygon::new(address, poly_rpc.clone());

        let logs = gov_contract
            .vote_emitted_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer, poly_rpc.clone())
            .await
            .context("bad votes")?;

        Ok((Vec::new(), votes, to_block))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
}

async fn get_votes(
    logs: Vec<(VoteEmittedFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
    rpc: Arc<Provider<Http>>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteEmittedFilter, LogMeta)> = logs.into_iter().collect();

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
                true => 0.into(),
                false => 1.into(),
            }),
            voting_power: Set((log.voting_power.as_u128() as f64) / (10.0f64.powi(18))),
            reason: NotSet,
            block_created: Set(Some(created_block_number as i32)),
            time_created: Set(Some(created_block_timestamp)),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(meta.transaction_hash.as_bytes())
            ))),
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod aave_v3_polygon_votes {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn aave_v3_polygon_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 52020671,
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

        match AaveV3PolygonVotesIndexer.process(&indexer, &dao).await {
            Ok((_, votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 52020671,
                    voter_address: "0x4f86A75764710683DAC3833dF49c72de3ec65465",
                    choice: json!(0),
                    voting_power: 0.01,
                    reason: None,
                    proposal_external_id: "0",
                    time_created: Some(parse_datetime("2024-01-06 21:21:58")),
                    block_created: Some(52020671),
                    txid: Some(
                        "0xacca98f5c86c5098ffb85c878c755873cfbfcc85e7fc0e4ae1076f7d02e64810",
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
