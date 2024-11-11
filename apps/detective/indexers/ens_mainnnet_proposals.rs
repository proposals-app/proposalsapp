use crate::{
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
    rpc_providers,
};
use alloy::{
    primitives::{address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use rust_decimal::prelude::ToPrimitive;
use scanners::etherscan::estimate_timestamp;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

pub struct EnsMainnetProposalsIndexer;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    ens_gov,
    "./abis/ens_gov.json"
);

#[async_trait]
impl Indexer for EnsMainnetProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

#[async_trait]
impl ProposalsIndexer for EnsMainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing ENS Proposals");

        let eth_rpc = rpc_providers::get_provider("ethereum")?;

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("323A76393544d5ecca80cd6ef2A560C6a395b7E3");

        let gov_contract = ens_gov::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .ProposalCreated_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal")?;
            proposals.push(p);
        }

        let new_index = proposals
            .iter()
            .filter(|p| {
                matches!(
                    p.proposal_state.as_ref(),
                    ProposalState::Active | ProposalState::Pending
                )
            })
            .filter_map(|p| match &p.index_created {
                ActiveValue::Set(value) => Some(*value),
                _ => None,
            })
            .min()
            .unwrap_or(to_block);

        Ok(ProcessResult::Proposals(proposals, new_index))
    }
}

async fn data_for_proposal(
    p: (ens_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: ens_gov::ens_govInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let (event, log): (ens_gov::ProposalCreated, Log) = p.clone();

    let created_block = rpc
        .get_block_by_number(log.block_number.unwrap().into(), false)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp =
        DateTime::from_timestamp(created_block.header.timestamp as i64, 0)
            .context("bad timestamp")?
            .naive_utc();

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
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

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
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

    let proposal_url = format!(
        "https://www.tally.xyz/gov/ens/proposal/{}",
        event.proposalId
    );

    let proposal_external_id = event.proposalId.to_string();

    let mut title = format!(
        "{:.120}",
        event
            .description
            .split('\n')
            .next()
            .unwrap_or("Unknown")
            .to_string()
    );

    if title.starts_with("# ") {
        title = title.split_off(2);
    }

    if title.is_empty() {
        title = "Unknown".into()
    }

    let body = event.description.to_string();

    let choices = vec!["For", "Against", "Abstain"];

    let proposal_votes = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_votes")?;

    let scores = vec![
        proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18))
        + proposal_votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorum(U256::from(log.block_number.unwrap()))
        .call()
        .await
        .context("gov_contract.quorum")?
        ._0
        .to::<u128>() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(event.proposalId)
        .call()
        .await
        .context("gov_contract.getProposalState")
        .map(|result| result._0)
        .unwrap_or(99); //default to Unknown

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

    let discussionurl = String::from("");

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: Set(discussionurl),
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(scores_quorum),
        quorum: Set(quorum),
        proposal_state: Set(state),
        marked_spam: NotSet,
        block_created: Set(Some(log.block_number.unwrap().to_i32().unwrap())),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(log.block_number.unwrap().to_i32().unwrap()),
        metadata: NotSet,
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

#[cfg(test)]
mod ens_mainnet_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn ens_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 19583608,
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

        match EnsMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 19583608,
                    external_id: "48839151689001950442481252711111182244814765601408465024742109276815020082612",
                    name: "[EP 5.5] Funding Request: ENS Public Goods Working Group Term 5 (Q1/Q2)",
                    body_contains: Some(vec!["The Public Goods working group funds projects and builders improving the Web3 ecosystems."]),
                    url: "https://www.tally.xyz/gov/ens/proposal/48839151689001950442481252711111182244814765601408465024742109276815020082612",
                    discussion_url: "",
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([1147743.2227877711, 0.0, 100517.72338324414]),
                    scores_total: 1248260.9461710153,
                    scores_quorum: 1248260.9461710153,
                    quorum: 1000000.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-04-04 16:32:35"),
                    time_start: parse_datetime("2024-04-04 16:32:47"),
                    time_end: parse_datetime("2024-04-11 02:32:23"),
                    block_created: Some(19583608),
                    txid: Some("0x4fae473d84fc46b3fc107338e413c15f40ad0871de68328dafb795f570cad01f"),
                    metadata: None,
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
