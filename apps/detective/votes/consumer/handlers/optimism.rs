use crate::{VotesHandler, VotesResult};
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
use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use sea_orm::{
    prelude::Uuid, ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection,
    EntityTrait, NotSet, QueryFilter, Set,
};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::DaoHandlerEnumV4, vote};
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use utils::errors::{
    DATABASE_CONNECTION_FAILED, DATABASE_ERROR, DATABASE_URL_NOT_SET, PROPOSAL_NOT_FOUND_ERROR,
};

pub struct OptimismHandler;

#[async_trait]
impl VotesHandler for OptimismHandler {
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

        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);
        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);
        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)?;

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
        let mut choice = vec![log.support.into()];

        let proposal_handler_id: Vec<Uuid> = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.is_in([DaoHandlerEnumV4::OpOptimism]))
            .all(db)
            .await
            .context(DATABASE_ERROR)?
            .into_iter()
            .map(|dh| dh.id)
            .collect();

        let mut proposal = proposal::Entity::find()
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
            serde_json::from_value(proposal.metadata.expect("bad proposal metadata"))?;

        //TODO: this only considers for votes
        //      against and abstain should be handled somehow as well
        //      this happens in vote without params

        if log.params.len() > 0 {
            if proposal_metadata.voting_module == "0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df" {
                let param_types = vec![ParamType::Array(Box::new(ParamType::Uint(256)))];

                let decoded =
                    decode(&param_types, &log.params).context("Failed to decode params")?;

                if let Some(ethers::abi::Token::Array(options)) = decoded.first() {
                    let mut current_scores: Vec<Decimal> =
                        serde_json::from_value(proposal.scores.clone())?;
                    let voting_power = Decimal::from_str(&log.weight.to_string())?
                        .checked_div(Decimal::from(10u64.pow(18)))
                        .unwrap_or(Decimal::ZERO);

                    choice = vec![];
                    for (_index, option) in options.iter().enumerate() {
                        if let ethers::abi::Token::Uint(value) = option {
                            let choice_index = value.as_u64() as usize;

                            if choice_index < current_scores.len() {
                                current_scores[choice_index] += voting_power;
                            }
                            choice.push(choice_index as i32);
                        }
                    }

                    let f64_scores: Vec<f64> = current_scores
                        .iter()
                        .map(|d| d.to_f64().unwrap_or(0.0))
                        .collect();

                    proposal.scores = serde_json::to_value(f64_scores)?;

                    proposal::Entity::update(proposal::ActiveModel {
                        id: Set(proposal.id),
                        scores: Set(proposal.scores),
                        ..Default::default()
                    })
                    .exec(db)
                    .await
                    .context(DATABASE_ERROR)?;
                }
            }

            if proposal_metadata.voting_module == "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5" {
                let param_types = vec![ParamType::Array(Box::new(ParamType::Uint(256)))];

                let decoded =
                    decode(&param_types, &log.params).context("Failed to decode params")?;

                choice = vec![];
                if let Some(ethers::abi::Token::Array(options)) = decoded.first() {
                    for option in options {
                        if let ethers::abi::Token::Uint(value) = option {
                            choice.push(value.as_u64() as i32);
                        }
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
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV4};
    use serde_json::json;
    use utils::test_utils::{assert_vote, ExpectedVote};

    #[tokio::test]
    async fn optimism_votes_1() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 74101902;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x406b607644c5D7BfDA95963201E45A4c6AB1c159",
                    voting_power: 2330197.528790091,
                    block_created: Some(74101902),
                    choice: json!(1),
                    proposal_external_id: "103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    reason: Some(String::from("SNX Ambassadors Test")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(74101903));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_2() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 74369711;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x062a07cBf4848fdA67292A96a5E02C97E402233F",
                    voting_power: 92728.25398901096,
                    block_created: Some(74369711),
                    choice: json!(0),
                    proposal_external_id: "103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    reason: Some(String::from("Test votes are for testing, not for not testing. Therefore I vote to test the not test by voting Against.")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(74369712));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_3() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 111313937;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x3D2d722B443A5cAE8E41877BB7cD649f3650937C",
                    voting_power: 1189039.363744706,
                    block_created: Some(111313937),
                    choice: json!(1),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    reason: Some(String::from("We have not been able to view every post and detail of this incident. This makes it hard to decide on the matter. This case makes clear that a different way of reporting misconduct has to be established. We appreciate that the Foundation will publish a whistleblower policy.")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(111313938));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_4() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 110940693;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x75536CF4f01c2bFa528F5c74DdC1232Db3aF3Ee5",
                    voting_power: 1495424.76453001,
                    block_created: Some(110940693),
                    choice: json!(2),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    reason: Some(String::from("")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(110940694));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_5() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 110770895;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
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

    #[tokio::test]
    async fn optimism_votes_6() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 101471217;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0xa6e8772af29b29B9202a073f8E36f447689BEef6",
                    voting_power: 1487917.604365689,
                    block_created: Some(101471217),
                    choice: json!([0,1,2]),
                    proposal_external_id: "2808108363564117434228597137832979672586627356483314020876637262618986508713",
                    reason: Some(String::from("These three delegates served on the Builders Subcommittee the previous season and did a good job. While we suspect Oxytocin would do a fine job based on their past involvement in Optimism governance, we don’t feel the Grants Council should lose momentum.")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(101471218));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_7() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 111684633;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0xE6156d93fbA1F2387fCe5f50f1BB45eF51ed5f2b",
                    voting_power: 42170.51198003142,
                    block_created: Some(111684633),
                    choice: json!([0,1,5]),
                    proposal_external_id: "47209512763162691916934752283791420767969951049918368296503715012448877295335",
                    reason: Some(String::from("")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(111684634));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_8() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 115261441;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x049e37b4276B58dB622Ab5db2ff2AfFCb40DC11C",
                    voting_power: 56351.64083348377,
                    block_created: Some(115261441),
                    choice: json!(0),
                    proposal_external_id: "114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    reason: Some(String::from("I agree with Jack")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(115261442));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_9() {
        let _ = dotenv().ok();
        let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context(DATABASE_CONNECTION_FAILED)
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::OpOptimism))
            .one(&db)
            .await
            .unwrap()
            .unwrap();

        dao_handler.votes_index = 121477396;
        dao_handler.votes_refresh_speed = 1;

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x2B888954421b424C5D3D9Ce9bB67c9bD47537d12",
                    voting_power: 3094818.5189178744,
                    block_created: Some(121477396),
                    choice: json!([0,1,5,9,15]),
                    proposal_external_id: "14140470239376219798070786387548096572382469675815006174305459677010858217673",
                    reason: Some(String::from("https://gov.optimism.io/t/grants-council-s6-election-town-hall/8268/13?u=lefterisjp")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(121477397));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }
}
