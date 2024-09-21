use crate::{setup_database, VotesHandler, VotesResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use contracts::gen::optimism_gov_v_6::{
    optimism_gov_v_6::optimism_gov_v6, VoteCastFilter, VoteCastWithParamsFilter,
};
use ethers::{
    abi::{decode, ParamType},
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::Address,
    utils::to_checksum,
};
use sea_orm::{
    prelude::Uuid, ColumnTrait, Condition, DatabaseConnection, EntityTrait, NotSet, QueryFilter,
    Set,
};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::DaoHandlerEnumV3, vote};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use utils::errors::{DATABASE_ERROR, DATABASE_URL_NOT_SET, PROPOSAL_NOT_FOUND_ERROR};

pub struct OptimismType3Handler;

#[async_trait]
impl VotesHandler for OptimismType3Handler {
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

        let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;
        let db = setup_database(&database_url).await?;

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
        let votes_with_params = get_votes_with_params(logs_with_params.clone(), dao_handler, &db)
            .await
            .context("bad votes")?;

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

async fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
    db: &DatabaseConnection,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParamsFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        let mut choice = vec![];

        let proposal_handler_id: Vec<Uuid> = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.is_in([
                DaoHandlerEnumV3::OpOptimismOld,
                DaoHandlerEnumV3::OpOptimismType1,
                DaoHandlerEnumV3::OpOptimismType2,
                DaoHandlerEnumV3::OpOptimismType3,
                DaoHandlerEnumV3::OpOptimismType4,
            ]))
            .all(db)
            .await
            .context(DATABASE_ERROR)?
            .into_iter()
            .map(|dh| dh.id)
            .collect();

        let proposal = proposal::Entity::find()
            .filter(
                Condition::all()
                    .add(proposal::Column::ExternalId.eq(log.proposal_id.to_string()))
                    .add(proposal::Column::DaoHandlerId.is_in(proposal_handler_id)),
            )
            .one(db)
            .await
            .context(DATABASE_ERROR)?
            .context(PROPOSAL_NOT_FOUND_ERROR)?;

        #[derive(Deserialize)]
        struct ProposalMetadata {
            voting_module: Value,
        }

        let proposal_metadata: ProposalMetadata =
            serde_json::from_value(proposal.metadata.unwrap_or_else(
                || json!({"voting_module": "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5"}),
            ))
            .unwrap();

        if proposal_metadata.voting_module == "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5" {
            let param_types = vec![ParamType::Array(Box::new(ParamType::Uint(256)))];

            let decoded = decode(&param_types, &log.params).context("Failed to decode params")?;

            if let Some(ethers::abi::Token::Array(options)) = decoded.first() {
                for option in options {
                    if let ethers::abi::Token::Uint(value) = option {
                        choice.push(value.as_u64() as i32);
                    }
                }
            }
        }

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(choice.into()),
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
    use utils::test_utils::{assert_vote, ExpectedVote};

    #[tokio::test]
    async fn optimism_votes_type_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV3::OpOptimismOld,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 106787763,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismType3Handler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x995013B47EF3A2B07b9e60dA6D1fFf8fa9C53Cf4",
                    voting_power: 1001481.1043390606,
                    block_created: Some(106787763),
                    choice: json!([1,2,3,4,5,6,8,9,10]),
                    proposal_external_id: "76298930109016961673734608568752969826843280855214969572559472848313136347131",
                    reason: Some(String::from("Opinion in forum")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(106787764));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }
}
