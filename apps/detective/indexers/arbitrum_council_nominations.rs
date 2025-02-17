use crate::{
    chain_data::{self},
    database::DB,
    indexer::{Indexer, ProcessResult, ProposalsAndVotesIndexer},
    indexers::arbitrum_council_nominations::arbitrum_security_council_nomination::Date,
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
    transports::http::Http,
};
use alloy_chains::NamedChain;
use anyhow::{bail, Context, Result};
use arbitrum_security_council_nomination::VoteCastForContender;
use async_trait::async_trait;
use chrono::DateTime;
use proposalsapp_db::models::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
    vote,
};
use regex::Regex;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, Condition, EntityTrait, IntoActiveModel, QueryFilter, Set,
};
use serde_json::json;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tracing::{info, instrument, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_security_council_nomination,
    "./abis/arbitrum_security_council_nomination.json"
);

pub struct ArbitrumCouncilNominationsProposalsAndVotesIndexer;

#[async_trait]
impl Indexer for ArbitrumCouncilNominationsProposalsAndVotesIndexer {
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
        IndexerVariant::ArbitrumCouncilNominations
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsAndVotesIndexer for ArbitrumCouncilNominationsProposalsAndVotesIndexer {
    #[instrument(skip_all)]
    async fn process_proposals_and_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Council Nominations and Votes");

        let arb_rpc = chain_data::get_chain_config(NamedChain::Arbitrum)?
            .provider
            .clone();

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("Failed to get block number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("8a1cDA8dee421cD06023470608605934c16A05a0");

        let contract = arbitrum_security_council_nomination::new(address, arb_rpc.clone());

        // Fetch ProposalCreated logs
        let created_proposal_logs = contract
            .ProposalCreated_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await?;

        // Fetch ProposalCanceled logs
        let canceled_proposal_logs = contract
            .ProposalCanceled_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await?;

        // Fetch ProposalExecuted logs
        let executed_proposal_logs = contract
            .ProposalExecuted_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await?;

        // Fetch NewNominee logs
        let nominee_logs = contract
            .ContenderAdded_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await?;

        // Fetch VoteCastForContender logs
        let vote_logs = contract
            .VoteCastForContender_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await?;

        // Get initial proposals from ProposalCreated logs
        let proposals = get_created_proposals(
            created_proposal_logs.clone(),
            &arb_rpc,
            indexer,
            contract.clone(),
        )
        .await?;

        // Get canceled proposals from ProposalCanceled logs
        let canceled_proposals = get_canceled_proposals(
            canceled_proposal_logs.clone(),
            &arb_rpc,
            indexer,
            contract.clone(),
        )
        .await?;

        // Get executed proposals from ProposalExecuted logs
        let executed_proposals = get_executed_proposals(
            executed_proposal_logs.clone(),
            &arb_rpc,
            indexer,
            contract.clone(),
        )
        .await?;

        // Merge with NewNominee logs
        let mut merged_proposals =
            merge_with_nominees(proposals, nominee_logs, &arb_rpc, indexer).await?;

        // Get votes from VoteCastForContender logs and update proposals scores
        let (votes, updated_proposals) = get_votes(
            merged_proposals.clone(),
            vote_logs.clone(),
            indexer,
            &arb_rpc,
            contract.clone(),
        )
        .await?;

        // Replace merged_proposals with updated_proposals
        merged_proposals = updated_proposals;

        let all_proposals = [merged_proposals, canceled_proposals, executed_proposals].concat();

        Ok(ProcessResult::ProposalsAndVotes(
            all_proposals,
            votes,
            to_block,
        ))
    }
}

#[instrument(skip_all)]
async fn get_votes(
    proposals: Vec<proposal::ActiveModel>,
    logs: Vec<(VoteCastForContender, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
    _contract: arbitrum_security_council_nomination::arbitrum_security_council_nominationInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<(Vec<vote::ActiveModel>, Vec<proposal::ActiveModel>)> {
    let mut votes: Vec<vote::ActiveModel> = vec![];

    // Convert proposals to a HashMap for easier lookup
    let mut proposals_map: std::collections::HashMap<String, proposal::ActiveModel> = proposals
        .into_iter()
        .map(|p| (p.external_id.clone().unwrap(), p))
        .collect();

    // Fetch proposals from the database only once if not found in proposals_map
    let mut db_proposals_fetched: std::collections::HashMap<String, proposal::ActiveModel> =
        HashMap::new();

    for (event, log) in logs {
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

        // First, try to find the proposal in proposals_map
        if !proposals_map.contains_key(&event.proposalId.to_string()) {
            let db = DB.get().unwrap();
            // If not found in proposals_map, fetch from the database once
            if let std::collections::hash_map::Entry::Vacant(e) =
                db_proposals_fetched.entry(event.proposalId.to_string())
            {
                match proposal::Entity::find()
                    .filter(
                        Condition::all()
                            .add(proposal::Column::DaoIndexerId.eq(indexer.id))
                            .add(proposal::Column::ExternalId.eq(event.proposalId.to_string())),
                    )
                    .one(db)
                    .await?
                {
                    Some(active_proposal) => {
                        e.insert(active_proposal.into_active_model());
                        None::<()> // Explicitly specify the type for `None`
                    }
                    None => bail!("Proposal not found for external ID: {}", event.proposalId),
                };
            }
        }

        let proposal = proposals_map
            .entry(event.proposalId.to_string())
            .or_insert_with(|| db_proposals_fetched[&event.proposalId.to_string()].clone());

        // Parse the choices and scores from the proposal
        let mut choices = match &proposal.choices.take() {
            Some(value) => value.clone(),
            None => serde_json::json!([]),
        };
        if !choices.is_array() {
            choices = serde_json::json!([]);
        }

        let mut scores = match &proposal.scores.take() {
            Some(value) => value.clone(),
            None => serde_json::json!([]),
        };
        if !scores.is_array() {
            scores = serde_json::json!([]);
        }

        // Find the index of the contender in the choices array
        let contender_index = match choices.as_array_mut() {
            Some(arr) => arr
                .iter()
                .position(|choice| choice.as_str() == Some(&event.contender.to_string())),
            None => bail!("Choices is not an array for proposal: {}", event.proposalId),
        };

        // Ensure scores array has the same length as choices array, initializing
        // missing scores to 0.0
        if let Some(index) = contender_index {
            while scores.as_array().unwrap().len() <= index {
                scores.as_array_mut().unwrap().push(serde_json::json!(0.0));
            }

            // Update the score for this choice
            let current_score: f64 = match &scores[index] {
                serde_json::Value::Number(num) => num.as_f64().unwrap_or_default(),
                _ => 0.0,
            };
            let new_score = current_score + (event.votes.to::<u128>() as f64 / (10.0f64.powi(18)));

            scores[index] = serde_json::json!(new_score);

            // Update scores_total
            if let Some(total) = proposal.scores_total.take() {
                proposal.scores_total = Set(total + new_score);
            } else {
                proposal.scores_total = Set(new_score);
            }

            // Determine the maximum score and update scores_quorum
            if let Some(max_score) = scores
                .as_array()
                .unwrap()
                .iter()
                .filter_map(|score| match score {
                    serde_json::Value::Number(num) => num.as_f64(),
                    _ => None,
                })
                .collect::<Vec<f64>>()
                .into_iter()
                .max_by(|a, b| a.total_cmp(b))
            {
                proposal.scores_quorum = Set(max_score);
            }
        }

        let vote_record = vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            voting_power: Set((event.votes.to::<u128>() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(created_block_number as i32)),
            created_at: Set(created_block_timestamp),
            choice: Set(json!(contender_index)),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(None),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        };

        // Update the proposal with new choices and scores
        proposal.choices = Set(choices);
        proposal.scores = Set(scores);

        // Add the vote to the votes vector
        votes.push(vote_record);
    }

    Ok((votes, proposals_map.into_values().collect()))
}

#[instrument(skip_all)]
async fn merge_with_nominees(
    proposals: Vec<proposal::ActiveModel>,
    nominee_logs: Vec<(arbitrum_security_council_nomination::ContenderAdded, Log)>,
    _rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<proposal::ActiveModel>> {
    // Convert proposals to a HashMap for easier lookup
    let mut proposals_map: std::collections::HashMap<String, proposal::ActiveModel> = proposals
        .into_iter()
        .map(|p| (p.external_id.clone().unwrap(), p))
        .collect();

    // Fetch proposals from the database only once if not found in proposals_map
    let mut db_proposals_fetched: std::collections::HashMap<String, proposal::ActiveModel> =
        HashMap::new();

    for (event, _log) in nominee_logs {
        let proposal_id_str = event.proposalId.to_string();
        let contender_str = event.contender.to_string();

        // First, try to find the proposal in proposals_map
        if !proposals_map.contains_key(&proposal_id_str) {
            let db = DB.get().unwrap();
            // If not found in proposals_map, fetch from the database once
            if !db_proposals_fetched.contains_key(&proposal_id_str) {
                match proposal::Entity::find()
                    .filter(
                        Condition::all()
                            .add(proposal::Column::DaoIndexerId.eq(indexer.id))
                            .add(proposal::Column::ExternalId.eq(event.proposalId.to_string())),
                    )
                    .one(db)
                    .await?
                {
                    Some(proposal) => db_proposals_fetched
                        .insert(event.proposalId.to_string(), proposal.into_active_model()),
                    None => bail!("Proposal not found for external ID: {}", event.proposalId),
                };
            }
        }

        let proposal = proposals_map
            .entry(event.proposalId.to_string())
            .or_insert_with(|| db_proposals_fetched[&event.proposalId.to_string()].clone());

        // Ensure choices is initialized with an empty array if it's NotSet
        if proposal.choices.is_not_set() {
            proposal.choices = Set(json!([]));
        }

        // Fetch current choices and ensure it's an array
        let mut choices: serde_json::Value = proposal.choices.clone().unwrap();
        if !choices.is_array() {
            choices = serde_json::json!([]);
        }

        if !choices
            .as_array_mut()
            .unwrap() // Safe to unwrap since we ensured it's an array above
            .contains(&serde_json::json!(contender_str))
        {
            choices
                .as_array_mut()
                .unwrap() // Safe to unwrap since we ensured it's an array above
                .push(serde_json::json!(contender_str));
            proposal.choices = Set(choices);
        }
    }

    Ok(proposals_map.into_values().collect())
}

#[instrument(skip_all)]
async fn get_created_proposals(
    logs: Vec<(arbitrum_security_council_nomination::ProposalCreated, Log)>,
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    contract: arbitrum_security_council_nomination::arbitrum_security_council_nominationInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<Vec<proposal::ActiveModel>> {
    let mut proposals: Vec<proposal::ActiveModel> = vec![];

    let url_regex = Regex::new(r"Security Council Election #(\d+)").unwrap();

    for (event, log) in logs {
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

        let created_block_datetime = DateTime::from_timestamp(created_block_timestamp as i64, 0)
            .context("bad timestamp")?
            .naive_utc();

        let voting_start_block_number = event.startBlock.to::<u64>();
        let mut voting_end_block_number = event.endBlock.to::<u64>();

        let gov_contract_end_block_number = contract
            .proposalDeadline(event.proposalId)
            .call()
            .await?
            ._0
            .to::<u64>();

        if gov_contract_end_block_number > voting_end_block_number {
            voting_end_block_number = gov_contract_end_block_number;
        }

        let average_block_time_millis = 12_200;

        let voting_starts_timestamp =
            match chain_data::estimate_timestamp(NamedChain::Mainnet, voting_start_block_number)
                .await
            {
                Ok(r) => r,
                Err(_) => {
                    let fallback = DateTime::from_timestamp_millis(
                        (log.block_timestamp.unwrap()
                            + (voting_start_block_number - log.block_number.unwrap())
                                * average_block_time_millis) as i64,
                    )
                    .context("bad timestamp")?
                    .naive_utc();
                    warn!(
                        "Could not estimate timestamp for {:?}",
                        voting_start_block_number
                    );
                    info!("Fallback to {:?}", fallback);
                    fallback
                }
            };

        let voting_ends_timestamp = match chain_data::estimate_timestamp(
            NamedChain::Mainnet,
            voting_end_block_number,
        )
        .await
        {
            Ok(r) => r,
            Err(_) => {
                let fallback = DateTime::from_timestamp_millis(
                    (log.block_timestamp.unwrap()
                        + (voting_end_block_number - log.block_number.unwrap())
                            * average_block_time_millis) as i64,
                )
                .context("bad timestamp")?
                .naive_utc();
                warn!(
                    "Could not estimate timestamp for {:?}",
                    voting_end_block_number
                );
                info!("Fallback to {:?}", fallback);
                fallback
            }
        };

        let url = url_regex.captures(&event.description)
                    .and_then(|caps| caps.get(1).map(|m| m.as_str()))
                    .map_or_else(String::new, |election_number| {
                        format!("https://www.tally.xyz/gov/arbitrum/council/security-council/election/{}/round-1", election_number)
                    });

        let proposal_snapshot = contract.proposalSnapshot(event.proposalId).call().await?._0;
        let quorum = contract
            .quorum(proposal_snapshot)
            .call()
            .await?
            ._0
            .to::<u128>() as f64
            / (10.0f64.powi(18));

        let proposal_state = contract.state(event.proposalId).call().await?._0;

        let state = match proposal_state {
            0 => ProposalState::Pending,
            1 => ProposalState::Active,
            2 => ProposalState::Canceled,
            3 => ProposalState::Defeated,
            4 => ProposalState::Succeeded,
            5 => ProposalState::Queued,
            6 => ProposalState::Expired,
            7 => ProposalState::Executed,
            _ => ProposalState::Unknown,
        };

        proposals.push(proposal::ActiveModel {
            id: NotSet,
            external_id: Set(event.proposalId.to_string()),
            author: Set(Some(event.proposer.to_string())),
            name: Set(event.description.clone()),
            body: Set(event.description.clone()),
            url: Set(url),
            discussion_url: NotSet,
            choices: Set(json!([])),
            scores: Set(json!([])),
            scores_total: Set(0.0),
            quorum: Set(quorum),
            scores_quorum: Set(0.0),
            proposal_state: Set(state),
            marked_spam: Set(false),
            block_created: Set(Some(log.block_number.unwrap().to_i32().unwrap())),
            created_at: Set(created_block_datetime),
            start_at: Set(voting_starts_timestamp),
            end_at: Set(voting_ends_timestamp),
            dao_indexer_id: Set(indexer.clone().id),
            dao_id: Set(indexer.clone().dao_id),
            index_created: Set(log.block_number.unwrap().to_i32().unwrap()),
            metadata: Set(json!({"vote_type": "unknown"}).into()),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        });
    }

    Ok(proposals)
}

#[instrument(skip_all)]
async fn get_canceled_proposals(
    logs: Vec<(arbitrum_security_council_nomination::ProposalCanceled, Log)>,
    _rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    contract: arbitrum_security_council_nomination::arbitrum_security_council_nominationInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<Vec<proposal::ActiveModel>> {
    let mut proposals: Vec<proposal::ActiveModel> = vec![];

    for (event, _log) in logs {
        let proposal_state = contract.state(event.proposalId).call().await?._0;

        let state = match proposal_state {
            0 => ProposalState::Pending,
            1 => ProposalState::Active,
            2 => ProposalState::Canceled,
            3 => ProposalState::Defeated,
            4 => ProposalState::Succeeded,
            5 => ProposalState::Queued,
            6 => ProposalState::Expired,
            7 => ProposalState::Executed,
            _ => ProposalState::Unknown,
        };

        proposals.push(proposal::ActiveModel {
            id: NotSet,
            external_id: Set(event.proposalId.to_string()),
            author: NotSet,
            name: NotSet,
            body: NotSet,
            url: NotSet,
            discussion_url: NotSet,
            choices: NotSet,
            scores: NotSet,
            scores_total: NotSet,
            quorum: NotSet,
            scores_quorum: NotSet,
            proposal_state: Set(state),
            marked_spam: NotSet,
            block_created: NotSet,
            created_at: NotSet,
            start_at: NotSet,
            end_at: NotSet,
            dao_indexer_id: Set(indexer.clone().id),
            dao_id: Set(indexer.clone().dao_id),
            index_created: NotSet,
            metadata: NotSet,
            txid: NotSet,
        });
    }

    Ok(proposals)
}

#[instrument(skip_all)]
async fn get_executed_proposals(
    logs: Vec<(arbitrum_security_council_nomination::ProposalExecuted, Log)>,
    _rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    contract: arbitrum_security_council_nomination::arbitrum_security_council_nominationInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<Vec<proposal::ActiveModel>> {
    let mut proposals: Vec<proposal::ActiveModel> = vec![];

    for (event, _log) in logs {
        let proposal_state = contract.state(event.proposalId).call().await?._0;

        let state = match proposal_state {
            0 => ProposalState::Pending,
            1 => ProposalState::Active,
            2 => ProposalState::Canceled,
            3 => ProposalState::Defeated,
            4 => ProposalState::Succeeded,
            5 => ProposalState::Queued,
            6 => ProposalState::Expired,
            7 => ProposalState::Executed,
            _ => ProposalState::Unknown,
        };

        proposals.push(proposal::ActiveModel {
            id: NotSet,
            external_id: Set(event.proposalId.to_string()),
            author: NotSet,
            name: NotSet,
            body: NotSet,
            url: NotSet,
            discussion_url: NotSet,
            choices: NotSet,
            scores: NotSet,
            scores_total: NotSet,
            quorum: NotSet,
            scores_quorum: NotSet,
            proposal_state: Set(state),
            marked_spam: NotSet,
            block_created: NotSet,
            created_at: NotSet,
            start_at: NotSet,
            end_at: NotSet,
            dao_indexer_id: Set(indexer.clone().id),
            dao_id: Set(indexer.clone().dao_id),
            index_created: NotSet,
            metadata: NotSet,
            txid: NotSet,
        });
    }

    Ok(proposals)
}

#[cfg(test)]
mod arbitrum_council_nominations_tests {
    use super::*;
    use dotenv::dotenv;
    use proposalsapp_db::models::sea_orm_active_enums::{IndexerType, IndexerVariant};
    use sea_orm::prelude::Uuid;
    use serde_json::json;
    use utils::test_utils::{
        assert_proposal, assert_vote, parse_datetime, ExpectedProposal, ExpectedVote,
    };

    #[tokio::test]
    async fn arbitrum_council_nominations_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbitrumCouncilNominations,
            indexer_type: IndexerType::ProposalsAndVotes,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 131335636,
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

        match ArbitrumCouncilNominationsProposalsAndVotesIndexer
            .process_proposals_and_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::ProposalsAndVotes(proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 131335636,
                    external_id: "60162688034199076810399696553527335539392294406806148400571326246927623831080",
                    name: "Security Council Election #0",
                    body_contains: Some(vec!["Security Council Election #0"]),
                    url: "https://www.tally.xyz/gov/arbitrum/council/security-council/election/0/round-1",
                    discussion_url: None,
                    choices: json!([]),
                    scores: json!([]),
                    scores_total: 0.0,
                    scores_quorum: 0.0,
                    quorum: 4717209.293083988,
                    proposal_state: ProposalState::Executed,
                    marked_spam: Some(false),
                    time_created: parse_datetime("2023-09-15 13:26:33"),
                    time_start: parse_datetime("2023-09-15 13:26:11"),
                    time_end: parse_datetime("2023-09-22 15:35:11"),
                    block_created: Some(131335636),
                    txid: Some("0xcb6787863f4001e1190f76ae29f14927ba8a7af0ba4f42f1f8b74730948f11db"),
                    metadata: json!({"vote_type": "unknown"}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn arbitrum_council_nominations_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbitrumCouncilNominations,
            indexer_type: IndexerType::ProposalsAndVotes,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 20550,
            index: 131335636,
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

        match ArbitrumCouncilNominationsProposalsAndVotesIndexer
            .process_proposals_and_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::ProposalsAndVotes(proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 131335636,
                    external_id: "60162688034199076810399696553527335539392294406806148400571326246927623831080",
                    name: "Security Council Election #0",
                    body_contains: Some(vec!["Security Council Election #0"]),
                    url: "https://www.tally.xyz/gov/arbitrum/council/security-council/election/0/round-1",
                    discussion_url: None,
                    choices: json!(["0x22AB891922f566F17B9827d016C2003Da69abAb9"]),
                    scores: json!([]),
                    scores_total: 0.0,
                    scores_quorum: 0.0,
                    quorum: 4717209.293083988,
                    proposal_state: ProposalState::Executed,
                    marked_spam: Some(false),
                    time_created: parse_datetime("2023-09-15 13:26:33"),
                    time_start: parse_datetime("2023-09-15 13:26:11"),
                    time_end: parse_datetime("2023-09-22 15:35:11"),
                    block_created: Some(131335636),
                    txid: Some("0xcb6787863f4001e1190f76ae29f14927ba8a7af0ba4f42f1f8b74730948f11db"),
                    metadata: json!({"vote_type": "unknown"}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn arbitrum_council_nominations_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbitrumCouncilNominations,
            indexer_type: IndexerType::ProposalsAndVotes,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 41392,
            index: 131335636,
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

        match ArbitrumCouncilNominationsProposalsAndVotesIndexer
            .process_proposals_and_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::ProposalsAndVotes(proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 131335636,
                    external_id: "60162688034199076810399696553527335539392294406806148400571326246927623831080",
                    name: "Security Council Election #0",
                    body_contains: Some(vec!["Security Council Election #0"]),
                    url: "https://www.tally.xyz/gov/arbitrum/council/security-council/election/0/round-1",
                    discussion_url: None,
                    choices: json!(["0x22AB891922f566F17B9827d016C2003Da69abAb9","0x3191e06b0EA9512D43c9fD9Fa7219e69C4806E5d"]),
                    scores: json!([0.0]),
                    scores_total: 0.0,
                    scores_quorum: 0.0,
                    quorum: 4717209.293083988,
                    proposal_state: ProposalState::Executed,
                    marked_spam: Some(false),
                    time_created: parse_datetime("2023-09-15 13:26:33"),
                    time_start: parse_datetime("2023-09-15 13:26:11"),
                    time_end: parse_datetime("2023-09-22 15:35:11"),
                    block_created: Some(131335636),
                    txid: Some("0xcb6787863f4001e1190f76ae29f14927ba8a7af0ba4f42f1f8b74730948f11db"),
                    metadata: json!({"vote_type": "unknown"}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn arbitrum_council_nominations_vote_test() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbitrumCouncilNominations,
            indexer_type: IndexerType::ProposalsAndVotes,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 43903,
            index: 131335636,
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

        match ArbitrumCouncilNominationsProposalsAndVotesIndexer
            .process_proposals_and_votes(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::ProposalsAndVotes(proposals, votes, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                assert!(!votes.is_empty(), "No votes were fetched");

                // Expected proposal details
                let expected_proposal = ExpectedProposal {
                    index_created: 131335636,
                    external_id: "60162688034199076810399696553527335539392294406806148400571326246927623831080",
                    name: "Security Council Election #0",
                    body_contains: Some(vec!["Security Council Election #0"]),
                    url: "https://www.tally.xyz/gov/arbitrum/council/security-council/election/0/round-1",
                    discussion_url: None,
                    choices: json!(["0x22AB891922f566F17B9827d016C2003Da69abAb9","0x3191e06b0EA9512D43c9fD9Fa7219e69C4806E5d"]),
                    scores: json!([89.03914779357004,196.33156333403127]),
                    scores_total: 285.37071112760134,
                    scores_quorum: 196.33156333403127,
                    quorum: 4717209.293083988,
                    proposal_state: ProposalState::Executed,
                    marked_spam: Some(false),
                    time_created: parse_datetime("2023-09-15 13:26:33"),
                    time_start: parse_datetime("2023-09-15 13:26:11"),
                    time_end: parse_datetime("2023-09-22 15:35:11"),
                    block_created: Some(131335636),
                    txid: Some("0xcb6787863f4001e1190f76ae29f14927ba8a7af0ba4f42f1f8b74730948f11db"),
                    metadata: json!({"vote_type": "unknown"}).into(),
                };

                // Find the expected proposal
                let proposal = proposals.iter().find(|p| {
                    p.external_id.clone().take().unwrap() == expected_proposal.external_id
                });
                assert!(proposal.is_some(), "Expected proposal not found");
                assert_proposal(proposal.unwrap(), &expected_proposal);

                // Expected votes details
                let expected_votes = vec![
                    ExpectedVote {
                        index_created: 131357204,
                        voter_address: "0x6E2A58b8427dc079e32341690c64D7A038cC0e71",
                        choice: json!(0),
                        voting_power: 0.0,
                        reason: None,
                        proposal_external_id: expected_proposal.external_id,
                        time_created: Some(parse_datetime("2023-09-15 15:00:51")),
                        block_created: Some(131357204),
                        txid: Some(
                            "0xbd1942d6759233db62f926a6eb880afad3216e1be23ab98f9464ddf09f32c2ad",
                        ),
                    },
                    ExpectedVote {
                        index_created: 131377377,
                        voter_address: "0x42c27251C710864Cf76f1b9918Ace3E585e6E21b",
                        choice: json!(0),
                        voting_power: 89.03914779357004,
                        reason: None,
                        proposal_external_id: expected_proposal.external_id,
                        time_created: Some(parse_datetime("2023-09-15 16:31:12")),
                        block_created: Some(131377377),
                        txid: Some(
                            "0x3b9a63fe6d9098d62cba059b00b16b10f299a35d8063cc80606bbd125374c0af",
                        ),
                    },
                    ExpectedVote {
                        index_created: 131379140,
                        voter_address: "0x42c27251C710864Cf76f1b9918Ace3E585e6E21b",
                        choice: json!(1),
                        voting_power: 0.0,
                        reason: None,
                        proposal_external_id: expected_proposal.external_id,
                        time_created: Some(parse_datetime("2023-09-15 16:39:31")),
                        block_created: Some(131379140),
                        txid: Some(
                            "0x4c4f79329cf85cd80b6081ac48831efd853bb4ac420168c8e4087d42aa0e2594",
                        ),
                    },
                    ExpectedVote {
                        index_created: 131379539,
                        voter_address: "0xce062E454D5C162DF053E3047CFD296f18Da3d60",
                        choice: json!(1),
                        voting_power: 196.33156333403127,
                        reason: None,
                        proposal_external_id: expected_proposal.external_id,
                        time_created: Some(parse_datetime("2023-09-15 16:41:24")),
                        block_created: Some(131379539),
                        txid: Some(
                            "0xeb03231e8511e371e6c295c21b8bad05b30cfb55851a051d56aeb92ae033ba33",
                        ),
                    },
                ];

                // Ensure the number of votes matches
                assert_eq!(
                    votes.len(),
                    expected_votes.len(),
                    "Number of votes does not match"
                );

                // Iterate through all votes and compare them one-to-one with expected votes
                for (vote, expected_vote) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected_vote);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
