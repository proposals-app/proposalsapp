use crate::{
    chain_data::{self},
    database::DB,
    indexer::{Indexer, ProcessResult, VotesIndexer},
};
use alloy::{
    dyn_abi::{DynSolType, DynSolValue},
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
};
use alloy_chains::NamedChain;
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use proposalsapp_db::models::{
    dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote,
};
use rust_decimal::prelude::*;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, Condition, EntityTrait, QueryFilter, Set,
};
use serde::Deserialize;
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    optimism_gov_v_6,
    "./abis/optimism_gov_v6.json"
);

pub struct OptimismVotesIndexer;

impl OptimismVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::OpOptimismProposals
    }
}

#[async_trait]
impl Indexer for OptimismVotesIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::OpOptimismVotes
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl VotesIndexer for OptimismVotesIndexer {
    #[instrument(skip_all)]
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Optimism Votes");

        let op_rpc = chain_data::get_chain_config(NamedChain::Optimism)?
            .provider
            .clone();

        let current_block = op_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("cDF27F107725988f2261Ce2256bDfCdE8B382B10");

        let gov_contract = optimism_gov_v_6::new(address, op_rpc.clone());

        let logs = gov_contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let logs_with_params = gov_contract
            .VoteCastWithParams_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let votes = get_votes(logs.clone(), indexer, &op_rpc)
            .await
            .context("bad votes")?;

        let votes_with_params = get_votes_with_params(logs_with_params.clone(), indexer, &op_rpc)
            .await
            .context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok(ProcessResult::Votes(all_votes, to_block))
    }
}

#[instrument(skip_all)]
async fn get_votes(
    logs: Vec<(optimism_gov_v_6::VoteCast, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(optimism_gov_v_6::VoteCast, Log)> = logs.into_iter().collect();

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
            choice: Set(event.support.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(event.reason)),
            created_at: Set(created_block_timestamp),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}

#[instrument(skip_all)]
async fn get_votes_with_params(
    logs: Vec<(optimism_gov_v_6::VoteCastWithParams, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
    let db = DB.get().unwrap();

    let voter_logs: Vec<(optimism_gov_v_6::VoteCastWithParams, Log)> = logs.into_iter().collect();

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

        let mut choice = vec![event.support.into()];

        let proposal_handler_id: Vec<Uuid> = dao_indexer::Entity::find()
            .filter(
                dao_indexer::Column::IndexerVariant.is_in([IndexerVariant::OpOptimismProposals]),
            )
            .all(db)
            .await?
            .into_iter()
            .map(|dh| dh.id)
            .collect();

        let mut proposal = proposal::Entity::find()
            .filter(
                Condition::all()
                    .add(proposal::Column::ExternalId.eq(event.proposalId.to_string()))
                    .add(proposal::Column::DaoIndexerId.is_in(proposal_handler_id)),
            )
            .one(db)
            .await?
            .unwrap();

        #[derive(Deserialize)]
        struct ProposalMetadata {
            voting_module: Value,
        }

        let proposal_metadata: ProposalMetadata =
            serde_json::from_value(proposal.metadata.expect("bad proposal metadata"))?;

        if !event.params.is_empty() {
            if proposal_metadata.voting_module == "0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df" {
                let param_types = DynSolType::Array(Box::new(DynSolType::Uint(256)));

                let decoded = param_types
                    .abi_decode(&event.params)
                    .map_err(|e| anyhow::anyhow!("Failed to decode params: {:?}", e))?;

                if let DynSolValue::Array(options) = decoded {
                    let mut current_scores: Vec<Decimal> =
                        serde_json::from_value(proposal.scores.clone())?;
                    let voting_power = Decimal::from_str(&event.weight.to_string())?
                        .checked_div(Decimal::from(10u64.pow(18)))
                        .unwrap_or(Decimal::ZERO);

                    choice = vec![];
                    for option in options {
                        let choice_index = option.as_uint().unwrap().0.to::<u64>() as usize;

                        if choice_index < current_scores.len() {
                            current_scores[choice_index] += voting_power;
                        }
                        choice.push(choice_index as i32);
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
                    .await?;
                }
            }

            if proposal_metadata.voting_module == "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5" {
                let param_types = DynSolType::Array(Box::new(DynSolType::Uint(256)));

                let decoded = param_types
                    .abi_decode(&event.params)
                    .map_err(|e| anyhow::anyhow!("Failed to decode params: {:?}", e))?;

                choice = vec![];
                if let DynSolValue::Array(options) = decoded {
                    for option in options {
                        choice.push(option.as_uint().unwrap().0.to::<u64>() as i32);
                    }
                }
            }
        }

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            voting_power: Set((event.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            choice: Set(choice.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(event.reason)),
            created_at: Set(created_block_timestamp),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod optimism_votes_tests {
    use super::*;
    use dotenv::dotenv;
    use proposalsapp_db::models::sea_orm_active_enums::IndexerType;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 74101902,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 74101902,
                    voter_address: "0x406b607644c5D7BfDA95963201E45A4c6AB1c159",
                    choice: json!(1),
                    voting_power: 2330197.528790091,
                    reason: Some("SNX Ambassadors Test"),
                    proposal_external_id: "103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    time_created: Some(parse_datetime("2023-02-13 14:05:10")),
                    block_created: Some(74101902),
                    txid: Some(
                        "0x41b0886d6785fa6854a144827fc4723f3e66c80d0a5bf6ef8b0ef0d2041ddccb",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 74369711,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 74369711,
                    voter_address: "0x062a07cBf4848fdA67292A96a5E02C97E402233F",
                    choice: json!(0),
                    voting_power: 92728.25398901096,
                    reason: Some("Test votes are for testing, not for not testing. Therefore I vote to test the not test by voting Against."),
                    proposal_external_id: "103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    time_created: Some(parse_datetime("2023-02-14 21:07:54")),
                    block_created: Some(74369711),
                    txid: Some(
                        "0xb5e06484e8c1fcb5858b6737d915ed02c863565a50caf335bf984fc034220c57",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 111313937,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created:  111313937,
                    voter_address: "0x3D2d722B443A5cAE8E41877BB7cD649f3650937C",
                    choice: json!(1),
                    voting_power: 1189039.363744706,
                    reason: Some("We have not been able to view every post and detail of this incident. This makes it hard to decide on the matter. This case makes clear that a different way of reporting misconduct has to be established. We appreciate that the Foundation will publish a whistleblower policy."),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    time_created: Some(parse_datetime("2023-10-25 09:37:31")),
                    block_created: Some(111313937),
                    txid: Some(
                        "0x4a1b157007d594ba4aa54b5fbcc23bbb73a4d89c5f7d3bae200890a459718912",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_4() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 110940693,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created:  110940693,
                    voter_address: "0x75536CF4f01c2bFa528F5c74DdC1232Db3aF3Ee5",
                    choice: json!(2),
                    voting_power: 1495424.76453001,
                    reason: Some(""),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    time_created: Some(parse_datetime("2023-10-16 18:16:03")),
                    block_created: Some(110940693),
                    txid: Some(
                        "0xf8a3d8dc54e455980c9b3be77df4749c19b4d8157d53d6c28292b54abe4202db",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_5() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 110770895,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created:  110770895,
                    voter_address: "0x4f41877773e44F2275dA1942FEe898556821bf66",
                    choice: json!(0),
                    voting_power: 1826137.2164138977,
                    reason: Some("Without commenting on the substance of his allegations or the related discussions, I believe what Carlos has posted in his response to the CoC notice with regard to whether there was intentional or malicious doxing. I take Carlos at his word that he was only invoking these people's identities because (1) they were already public in several different domains, as supported by his screenshots, and (2) they were relevant to the claims he was making regarding connections between different organizations. I would however remind Carlos that there is an extremely high bar of support and context needed to substantiate allegations like his. Zooming out, I'm glad a CoC council is being formed and encourage people to apply."),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    time_created: Some(parse_datetime("2023-10-12 19:56:07")),
                    block_created: Some(110770895),
                    txid: Some(
                        "0x7b31fc1b1c8b400314736986d66e8e766d6637547aa2c29dd9a240aef1f69f34",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_6() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 101471217,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created:  101471217,
                    voter_address: "0xa6e8772af29b29B9202a073f8E36f447689BEef6",
                    choice: json!([0,1,2]),
                    voting_power: 1487917.604365689,
                    reason: Some("These three delegates served on the Builders Subcommittee the previous season and did a good job. While we suspect Oxytocin would do a fine job based on their past involvement in Optimism governance, we don’t feel the Grants Council should lose momentum."),
                    proposal_external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    time_created: Some(parse_datetime("2023-10-12 19:56:07")),
                    block_created: Some(101471217),
                    txid: Some(
                        "0x7b31fc1b1c8b400314736986d66e8e766d6637547aa2c29dd9a240aef1f69f34",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_7() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 111684633,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created:  111684633,
                    voter_address: "0xE6156d93fbA1F2387fCe5f50f1BB45eF51ed5f2b",
                    choice: json!([0,1,5]),
                    voting_power: 42170.51198003142,
                    reason: Some(""),
                    proposal_external_id: "47209512763162691916934752283791420767969951049918368296503715012448877295335",
                    time_created: Some(parse_datetime("2023-10-12 19:56:07")),
                    block_created: Some(111684633),
                    txid: Some(
                        "0x7b31fc1b1c8b400314736986d66e8e766d6637547aa2c29dd9a240aef1f69f34",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_votes_8() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 115261441,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
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

        match OptimismVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created:  115261441,
                    voter_address: "0x049e37b4276B58dB622Ab5db2ff2AfFCb40DC11C",
                    choice: json!(0),
                    voting_power: 56351.64083348377,
                    reason: Some("I agree with Jack"),
                    proposal_external_id: "114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    time_created: Some(parse_datetime("2024-01-24T18:40:59")),
                    block_created: Some(115261441),
                    txid: Some(
                        "0x7b31fc1b1c8b400314736986d66e8e766d6637547aa2c29dd9a240aef1f69f34",
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
