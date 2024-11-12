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
use scanners::etherscan;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::sea_orm_active_enums::IndexerType;
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_core_gov,
    "./abis/arbitrum_core_gov.json"
);

pub struct ArbitrumCouncilNominationProposalsIndexer;

#[async_trait]
impl Indexer for ArbitrumCouncilNominationProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Proposals
    }
}

#[async_trait]
impl ProposalsIndexer for ArbitrumCouncilNominationProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Core Proposals");

        let arb_rpc = rpc_providers::get_provider("arbitrum")?;

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("f07DeD9dC292157749B6Fd268E37DF6EA38395B9");

        let gov_contract = arbitrum_core_gov::new(address, arb_rpc.clone());

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
            let p = data_for_proposal(p.clone(), &arb_rpc, indexer, gov_contract.clone())
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
    p: (arbitrum_core_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: arbitrum_core_gov::arbitrum_core_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (arbitrum_core_gov::ProposalCreated, Log) = p.clone();

    let created_block_timestamp = rpc
        .get_block_by_number(log.block_number.unwrap().into(), false)
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

    let gov_contract_end_block_number = gov_contract
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
        match etherscan::estimate_timestamp(voting_start_block_number).await {
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

    let voting_ends_timestamp = match etherscan::estimate_timestamp(voting_end_block_number).await {
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
        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
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

    let onchain_proposal = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposalVotes")?;

    let choices = vec!["For", "Against", "Abstain"];

    let scores = vec![
        onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18))
        + onchain_proposal.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let proposal_snapshot_block = gov_contract
        .proposalSnapshot(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposalSnapshot")?
        ._0;

    let quorum = match gov_contract.quorum(proposal_snapshot_block).call().await {
        Ok(r) => r._0.to::<u128>() as f64 / (10.0f64.powi(18)),
        Err(_) => U256::from(0).to::<u128>() as f64 / (10.0f64.powi(18)),
    };

    let proposal_state = gov_contract
        .state(event.proposalId)
        .call()
        .await
        .context("gov_contract.state")?
        ._0;

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
        time_created: Set(created_block_datetime),
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

// #[cfg(test)]
// mod arbitrum_core_proposals {
//     use super::*;
//     use dotenv::dotenv;
//     use sea_orm::prelude::Uuid;
//     use seaorm::sea_orm_active_enums::IndexerVariant;
//     use serde_json::json;
//     use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

//     #[tokio::test]
//     async fn arbitrum_core_1() {
//         let _ = dotenv().ok();

//         let indexer = dao_indexer::Model {
//             id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
//             indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
//             indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
//             portal_url: Some("placeholder".into()),
//             enabled: true,
//             speed: 1,
//             index: 98424027,
//             dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
//         };

//         let dao = dao::Model {
//             id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
//             name: "placeholder".into(),
//             slug: "placeholder".into(),
//             hot: true,
//             picture: "placeholder".into(),
//             background_color: "placeholder".into(),
//             email_quorum_warning_support: true,
//         };

//         match ArbitrumCouncilNominationProposalsIndexer
//             .process_proposals(&indexer, &dao)
//             .await
//         {
//             Ok(ProcessResult::Proposals(proposals, _)) => {
//                 assert!(!proposals.is_empty(), "No proposals were fetched");
//                 let expected_proposals = [ExpectedProposal {
//                     index_created: 98424027,
//                     external_id: "77049969659962393408182308518930939247285848107346513112985531885924337078488",
//                     name: "AIP-1.2 - Foundation and DAO Governance",
//                     body_contains: Some(vec!["proposes amendments to the Constitution, and The Arbitrum Foundation Amended & Restated Memorandum & Articles of Association "]),
//                     url: "https://www.tally.xyz/gov/arbitrum/proposal/77049969659962393408182308518930939247285848107346513112985531885924337078488",
//                     discussion_url: "",
//                     choices: json!(["For", "Against", "Abstain"]),
//                     scores: json!([184321656.8392574, 102537.9383272933, 82161.17151725784]),
//                     scores_total: 184506355.94910192,
//                     scores_quorum: 184403818.01077464,
//                     quorum: 143344589.07709968,
//                     proposal_state: ProposalState::Executed,
//                     marked_spam: None,
//                     time_created: parse_datetime("2023-06-06 15:56:32"),
//                     time_start: parse_datetime("2023-06-09 17:04:35"),
//                     time_end: parse_datetime("2023-06-23 21:05:35"),
//                     block_created: Some(98424027),
//                     txid: Some("0xea591d2cba10b1e386791334ba528bd3dde79bdc38c4b3ba69c4eb639b08eb0e"),
//                     metadata: None,
//                 }];
//                 for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
//                     assert_proposal(proposal, expected);
//                 }
//             }
//             _ => panic!("Failed to index"),
//         }
//     }
// }
