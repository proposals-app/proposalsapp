use crate::{VotesHandler, VotesResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use contracts::gen::lido_aragon_voting::{lido_aragon_voting, CastVoteFilter};
use ethers::{
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::Address,
    utils::to_checksum,
};
use sea_orm::{NotSet, Set};
use seaorm::{dao, dao_handler, proposal, vote};
use std::sync::Arc;
use tracing::{info, instrument};

pub struct LidoHandler;

#[async_trait]
impl VotesHandler for LidoHandler {
    async fn get_proposal_votes(
        &self,
        _dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
        _proposal: &proposal::Model,
    ) -> Result<VotesResult> {
        Ok(VotesResult {
            votes: vec![],
            to_index: None,
        })
    }
    #[instrument(skip(self, dao_handler), fields(dao_handler_id = %dao_handler.id))]
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult> {
        info!("Fetching votes for LidoHandler");
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
            .as_u64();

        let from_block = dao_handler.votes_index as u64;
        let to_block = if dao_handler.votes_index as u64 + dao_handler.votes_refresh_speed as u64
            > current_block
        {
            current_block
        } else {
            dao_handler.votes_index as u64 + dao_handler.votes_refresh_speed as u64
        };

        let address = "0x2e59a20f205bb85a89c53f1936454680651e618e"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = lido_aragon_voting::lido_aragon_voting::new(address, eth_rpc);

        let logs = gov_contract
            .cast_vote_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), dao_handler).context("bad votes")?;

        Ok(VotesResult {
            votes,
            to_index: Some(to_block as i32),
        })
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

fn get_votes(
    logs: Vec<(CastVoteFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(CastVoteFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.stake.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.supports {
                true => 0.into(),
                false => 1.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.vote_id.to_string()),
            dao_id: Set(dao_handler.dao_id),
            dao_handler_id: Set(dao_handler.id),
            ..Default::default()
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod lido_votes {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV4};
    use serde_json::json;
    use utils::test_utils::{assert_vote, ExpectedVote};

    #[tokio::test]
    async fn lido_votes_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::AaveV3Mainnet,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 1,
            votes_index: 20233212,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match LidoHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x7eE09c11D6Dc9684D6D5a4C6d333e5b9e336bb6C",
                    voting_power: 5016797.950057261,
                    block_created: Some(20233212),
                    choice: json!(0),
                    proposal_external_id: "175",
                    reason: Some(String::from("")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn lido_votes_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::AaveV3Mainnet,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 0,
            votes_refresh_speed: 14679507 - 14678817,
            proposals_index: 0,
            votes_index: 14678817,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match LidoHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [
                    ExpectedVote {
                        voter_address: "0x7eE09c11D6Dc9684D6D5a4C6d333e5b9e336bb6C",
                        voting_power: 8350129.950057261,
                        block_created: Some(14678817),
                        choice: json!(0),
                        proposal_external_id: "126",
                        reason: Some(String::from("")),
                    },
                    ExpectedVote {
                        voter_address: "0x1f3813fE7ace2a33585F1438215C7F42832FB7B3",
                        voting_power: 18279999.0,
                        block_created: Some(14679507),
                        choice: json!(0),
                        proposal_external_id: "126",
                        reason: Some(String::from("")),
                    },
                ];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }
}
