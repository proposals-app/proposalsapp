use crate::{VotesHandler, VotesResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use contracts::gen::optimism_gov_v_6::{
    optimism_gov_v_6::optimism_gov_v6, VoteCastFilter, VoteCastWithParamsFilter,
};
use ethers::{
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::Address,
    utils::to_checksum,
};
use sea_orm::{NotSet, Set};
use seaorm::{dao, dao_handler, proposal, vote};
use std::sync::Arc;

pub struct OptimismType4Handler;

#[async_trait]
impl VotesHandler for OptimismType4Handler {
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
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult> {
        let op_rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
        let op_rpc = Arc::new(Provider::<Http>::try_from(op_rpc_url).unwrap());

        let current_block = op_rpc
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

        let address = "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = optimism_gov_v6::new(address, op_rpc);

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

        let votes = get_votes(logs.clone(), dao_handler).context("bad votes")?;
        let votes_with_params =
            get_votes_with_params(logs_with_params.clone(), dao_handler).context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok(VotesResult {
            votes: all_votes,
            to_index: Some(to_block as i32),
        })
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
}

fn get_votes(
    logs: Vec<(VoteCastFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
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
            choice: Set(log.support.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id),
            dao_handler_id: Set(dao_handler.id),
            reason: Set(Some(log.reason)),
            ..Default::default()
        })
    }

    Ok(votes)
}

fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
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
            choice: Set(log.support.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id),
            dao_handler_id: Set(dao_handler.id),
            reason: Set(Some(log.reason)),
            ..Default::default()
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod optimism_votes {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV3};
    use serde_json::json;
    use utils::test_utils::{assert_vote, ExpectedVote};

    #[tokio::test]
    async fn optimism_votes_type_4() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV3::OpOptimismType4,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 110770895,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismType4Handler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x4f41877773e44F2275dA1942FEe898556821bf66",
                    voting_power: 1826137.2164138977,
                    block_created: Some(110770895),
                    choice: json!(0),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    reason: Some(String::from("Without commenting on the substance of his allegations or the related discussions, I believe what Carlos has posted in his response to the CoC notice with regard to whether there was intentional or malicious doxing. I take Carlos at his word that he was only invoking these people's identities because (1) they were already public in several different domains, as supported by his screenshots, and (2) they were relevant to the claims he was making regarding connections between different organizations. I would however remind Carlos that there is an extremely high bar of support and context needed to substantiate allegations like his. Zooming out, I'm glad a CoC council is being formed and encourage people to apply.")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(110770896));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }
}