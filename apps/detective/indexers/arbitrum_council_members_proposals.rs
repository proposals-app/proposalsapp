use crate::{
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
    rpc_providers,
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::ActiveValue::{self};
use seaorm::sea_orm_active_enums::IndexerType;
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_security_council_member_election,
    "./abis/arbitrum_security_council_member_election.json"
);

pub struct ArbitrumCouncilMemberProposalsIndexer;

#[async_trait]
impl Indexer for ArbitrumCouncilMemberProposalsIndexer {
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
impl ProposalsIndexer for ArbitrumCouncilMemberProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Council Members Proposals");

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

        let address = address!("467923B9AE90BDB36BA88eCA11604D45F13b712C");

        let gov_contract = arbitrum_security_council_member_election::new(address, arb_rpc.clone());

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
    p: (
        arbitrum_security_council_member_election::ProposalCreated,
        Log,
    ),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: arbitrum_security_council_member_election::arbitrum_security_council_member_electionInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (
        arbitrum_security_council_member_election::ProposalCreated,
        Log,
    ) = p.clone();

    Ok(proposal::ActiveModel {
        id: todo!(),
        index_created: todo!(),
        external_id: todo!(),
        name: todo!(),
        body: todo!(),
        url: todo!(),
        discussion_url: todo!(),
        choices: todo!(),
        scores: todo!(),
        scores_total: todo!(),
        quorum: todo!(),
        scores_quorum: todo!(),
        proposal_state: todo!(),
        marked_spam: todo!(),
        time_created: todo!(),
        time_start: todo!(),
        time_end: todo!(),
        block_created: todo!(),
        txid: todo!(),
        metadata: todo!(),
        dao_indexer_id: todo!(),
        dao_id: todo!(),
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

//         match ArbitrumCouncilMembersProposalsIndexer
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
