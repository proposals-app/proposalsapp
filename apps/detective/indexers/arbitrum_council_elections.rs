use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsAndVotesIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_security_council_election,
    "./abis/arbitrum_security_council_election.json"
);

pub struct ArbitrumCouncilElectionsProposalsAndVotesIndexer;

#[async_trait]
impl Indexer for ArbitrumCouncilElectionsProposalsAndVotesIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::ArbitrumCouncilElections
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsAndVotesIndexer for ArbitrumCouncilElectionsProposalsAndVotesIndexer {
    #[instrument(skip_all)]
    async fn process_proposals_and_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Council Elections and Votes");

        let arb_rpc = chain_data::get_chain_config(Chain::Arbitrum)?
            .provider
            .clone();

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("467923B9AE90BDB36BA88eCA11604D45F13b712C");

        let contract = arbitrum_security_council_election::new(address, arb_rpc.clone());

        let proposal_logs = contract
            .ProposalCreated_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let proposals = get_proposals(proposal_logs.clone(), &arb_rpc, indexer, contract.clone())
            .await
            .context("bad proposals")?;

        // let nominee_logs = contract
        //     .NewNominee_filter()
        //     .from_block(from_block.to_u64().unwrap())
        //     .to_block(to_block.to_u64().unwrap())
        //     .address(address)
        //     .query()
        //     .await
        //     .context("query")?;

        // let mut nominees_map = get_nominees(nominee_logs.clone())
        //     .await
        //     .context("bad nominees")?;

        // let vote_logs = contract
        //     .VoteCastForContender_filter()
        //     .from_block(from_block.to_u64().unwrap())
        //     .to_block(to_block.to_u64().unwrap())
        //     .address(address)
        //     .query()
        //     .await
        //     .context("query")?;

        // let votes = get_votes(
        //     vote_logs.clone(),
        //     indexer,
        //     &arb_rpc.clone(),
        //     &mut nominees_map,
        // )
        // .await
        // .context("bad votes")?;

        Ok(ProcessResult::ProposalsAndVotes(
            proposals,
            vec![],
            to_block,
        ))
    }
}

#[instrument(skip_all)]
async fn get_proposals(
    logs: Vec<(arbitrum_security_council_election::ProposalCreated, Log)>,
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    contract: arbitrum_security_council_election::arbitrum_security_council_electionInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<Vec<proposal::ActiveModel>> {
    let mut proposals: Vec<proposal::ActiveModel> = vec![];

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

        let voting_starts_timestamp = match chain_data::estimate_timestamp(
            Chain::Ethereum,
            voting_start_block_number,
        )
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

        let voting_ends_timestamp =
            match chain_data::estimate_timestamp(Chain::Ethereum, voting_end_block_number).await {
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

        proposals.push(proposal::ActiveModel {
            id: NotSet,
            external_id: Set(event.proposalId.to_string()),
            author: Set(Some(event.proposer.to_string())),
            name: Set(format!("Nomination Proposal for {}", event.description)),
            body: Set(String::new()), // Fill with actual description if available
            url: Set(String::new()),  // Fill with actual URL if available
            discussion_url: NotSet,   // Fill with actual discussion URL if available
            choices: NotSet,
            scores: NotSet,
            scores_total: Set(0.0),
            quorum: Set(1.0), // Adjust as needed
            scores_quorum: Set(0.0),
            proposal_state: Set(ProposalState::Active),
            marked_spam: Set(false),
            block_created: Set(Some(log.block_number.unwrap().to_i32().unwrap())),
            time_created: Set(created_block_datetime),
            time_start: Set(voting_starts_timestamp),
            time_end: Set(voting_ends_timestamp),
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

// #[cfg(test)]
// mod arbitrum_council_elections_tests {
//     use super::*;
//     use dotenv::dotenv;
//     use sea_orm::prelude::Uuid;
//     use seaorm::sea_orm_active_enums::IndexerVariant;
//     use serde_json::json;
//     use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

//     #[tokio::test]
//     async fn arbitrum_council_elections_1() {
//         let _ = dotenv().ok();

//         let indexer = dao_indexer::Model {
//             id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
//             indexer_variant: IndexerVariant::ArbitrumCouncilNominations,
//             indexer_type: seaorm::sea_orm_active_enums::IndexerType::ProposalsAndVotes,
//             portal_url: Some("placeholder".into()),
//             enabled: true,
//             speed: 1,
//             index: 131335636,
//             dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
//             updated_at: chrono::Utc::now().naive_utc(),
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

//         match ArbitrumCouncilElectionsProposalsAndVotesIndexer
//             .process_proposals_and_votes(&indexer, &dao)
//             .await
//         {
//             Ok(ProcessResult::ProposalsAndVotes(proposals, _, _)) => {
//                 assert!(!proposals.is_empty(), "No proposals were fetched");
//                 let expected_proposals = [ExpectedProposal {
//                     index_created: 0,          // Adjust based on actual data
//                     external_id: "1234567890", // Replace with the actual proposal ID
//                     name: "Nomination Proposal for Example",
//                     body_contains: Some(vec!["Description of the nomination proposal."]), // Add actual description if available
//                     url: "",              // Add actual URL if available
//                     discussion_url: None, // Add actual discussion URL if available
//                     choices: json!([]),   // Adjust based on actual data
//                     scores: json!([]),    // Adjust based on actual data
//                     scores_total: 0.0,    // Adjust based on actual data
//                     scores_quorum: 0.0,   // Adjust based on actual data
//                     quorum: 1.0,          // Default value in the code is 1.0
//                     proposal_state: ProposalState::Active,
//                     marked_spam: Some(false),
//                     time_created: parse_datetime("2023-10-01 00:00:00"),
//                     time_start: parse_datetime("2023-10-01 00:00:00"),
//                     time_end: parse_datetime("2023-09-22 15:35:11"),
//                     block_created: Some(131335636),
//                     txid: Some(""), // Add actual transaction ID if available
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
