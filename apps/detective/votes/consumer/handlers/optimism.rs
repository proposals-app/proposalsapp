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
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::DaoHandlerEnumV4, vote};
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use utils::errors::{DATABASE_ERROR, DATABASE_URL_NOT_SET, PROPOSAL_NOT_FOUND_ERROR};

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

        let database_url = std::env::var("DATABASE_URL").context(DATABASE_URL_NOT_SET)?;
        let db = setup_database(&database_url).await?;

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

        if log.params.len() > 0 {
            if proposal_metadata.voting_module == "0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df" {
                let param_types = vec![ParamType::Array(Box::new(ParamType::Uint(256)))];

                let decoded =
                    decode(&param_types, &log.params).context("Failed to decode params")?;

                if let Some(ethers::abi::Token::Array(options)) = decoded.first() {
                    let mut current_scores: Vec<f64> =
                        serde_json::from_value(proposal.scores.clone())?;
                    let voting_power = (log.weight.as_u128() as f64) / (10.0f64.powi(18));

                    choice = vec![];
                    for (index, option) in options.iter().enumerate() {
                        if let ethers::abi::Token::Uint(value) = option {
                            let choice_index = value.as_u64() as usize;

                            if choice_index < current_scores.len() {
                                current_scores[choice_index] += voting_power;
                            }
                            choice.push(choice_index as i32);
                        }
                    }

                    // Update proposal scores
                    proposal.scores = serde_json::to_value(current_scores)?;

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
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV4};
    use serde_json::json;
    use utils::test_utils::{assert_vote, ExpectedVote};

    #[tokio::test]
    async fn optimism_votes_type_1_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 115004770,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0xC776cBDDeA014889E8BaB4323C894C5c34DB214D",
                    voting_power: 2.84234644277626,
                    block_created: Some(115004770),
                    choice: json!(1),
                    proposal_external_id: "64861580915106728278960188313654044018229192803489945934331754023009986585740",
                    reason: Some(String::from("I think this is a good feature")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(115004771));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_type_1_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 115257697,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0xB1F34669752D645F7fbf5B6f3E3CB9ADFf0528b2",
                    voting_power: 1.91,
                    block_created: Some(115257697),
                    choice: json!(0),
                    proposal_external_id: "64861580915106728278960188313654044018229192803489945934331754023009986585740",
                    reason: Some(String::from("")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(115257698));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_type_2_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 115261441,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

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
    async fn optimism_votes_type_2_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 125536414,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0xa6e8772af29b29B9202a073f8E36f447689BEef6",
                    voting_power: 2347714.047381486,
                    block_created: Some(125536414),
                    choice: json!([1, 0, 4, 5, 6]),
                    proposal_external_id: "21837554113321175128753313420738380328565785926226611271713131734865736260549",
                    reason: Some(String::from("These all are needs or experiments we find compelling – in particular the very successful and in-demand audit grants. The other Mission Requests are helpful for business development and attracting new users and protocols to Optimism.\n\nOthers simply seemed like they needed more clear scope or different budget sizing to be effective. Or were low priority because they are largely done but not easy to find in one place (e.g. auditing the financial holdings of governance), so don’t require an entire Mission Request.\n")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(125536415));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_votes_type_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 106787763,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x995013B47EF3A2B07b9e60dA6D1fFf8fa9C53Cf4",
                    voting_power: 1001481.1043390606,
                    block_created: Some(106787763),
                    choice: json!([0,1,2,3,4,5,6,8,9,10]),
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

    #[tokio::test]
    async fn optimism_votes_type_4() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 110770895,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

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
    async fn optimism_votes_type_6() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("b2aa8bdf-05eb-408d-b4ad-4fa763e7381c").unwrap(),
            handler_type: DaoHandlerEnumV4::OpOptimism,
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 0,
            votes_index: 121605973,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        match OptimismHandler.get_dao_votes(&dao_handler).await {
            Ok(result) => {
                assert!(!result.votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    voter_address: "0x1B686eE8E31c5959D9F5BBd8122a58682788eeaD",
                    voting_power: 5092968.075942574,
                    block_created: Some(121605973),
                    choice: json!([0,1,2,5,6]),
                    proposal_external_id: "14140470239376219798070786387548096572382469675815006174305459677010858217673",
                    reason: Some(String::from("")),
                }];
                for (vote, expected) in result.votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
                assert_eq!(result.to_index, Some(121605974));
            }
            Err(e) => panic!("Failed to get votes: {:?}", e),
        }
    }
}
