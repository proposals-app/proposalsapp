use crate::{
    indexer::{Indexer, ProcessResult, VotesIndexer},
    rpc_providers,
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
};
use anyhow::{Context, Result};
use arbitrum_security_council_member_election::VoteCast;
use async_trait::async_trait;
use rust_decimal::prelude::ToPrimitive;
use seaorm::sea_orm_active_enums::IndexerType;
use seaorm::{dao, dao_indexer, sea_orm_active_enums::IndexerVariant, vote};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_security_council_member_election,
    "./abis/arbitrum_security_council_member_election.json"
);

pub struct ArbitrumCouncilMemberVotesIndexer;

impl ArbitrumCouncilMemberVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::ArbitrumCouncilMemberProposal
    }
}

#[async_trait]
impl Indexer for ArbitrumCouncilMemberVotesIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Votes
    }
}

#[async_trait]
impl VotesIndexer for ArbitrumCouncilMemberVotesIndexer {
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Council Members Votes");

        let arb_rpc = rpc_providers::get_provider("arbitrum")?;

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

        let contract = arbitrum_security_council_member_election::new(address, arb_rpc.clone());

        let logs = contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let votes = get_votes(logs.clone(), indexer, &arb_rpc.clone())
            .await
            .context("bad votes")?;

        Ok(ProcessResult::Votes(votes, to_block))
    }
}

async fn get_votes(
    logs: Vec<(VoteCast, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCast, Log)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (event, log) in voter_logs {
        votes.push(vote::ActiveModel {
            id: todo!(),
            index_created: todo!(),
            voter_address: todo!(),
            choice: todo!(),
            voting_power: todo!(),
            reason: todo!(),
            proposal_external_id: todo!(),
            time_created: todo!(),
            block_created: todo!(),
            txid: todo!(),
            proposal_id: todo!(),
            dao_id: todo!(),
            indexer_id: todo!(),
        })
    }

    Ok(votes)
}

// #[cfg(test)]
// mod arbitrum_core_votes {
//     use super::*;
//     use dotenv::dotenv;
//     use sea_orm::prelude::Uuid;
//     use seaorm::sea_orm_active_enums::IndexerVariant;
//     use serde_json::json;
//     use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

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
//             index: 259606191,
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

//         match ArbitrumCouncilMembersVotesIndexer.process_votes(&indexer, &dao).await {
//             Ok(ProcessResult::Votes(votes, _)) => {
//                 assert!(!votes.is_empty(), "No votes were fetched");
//                 let expected_votes = [ExpectedVote {
//                     index_created: 259606191,
//                     voter_address: "0xE594469fDe6AE29943a64f81d95c20F5F8eB2e04",
//                     choice: json!(0),
//                     voting_power: 100.0,
//                     reason: Some("this makes Arbitrum closer to become a Stage 2 Ethereum L2 network.\nhttps://forum.arbitrum.foundation/t/constitutional-extend-delay-on-l2time-lock/26470/57"),
//                     proposal_external_id: "27888300053486667232765715922683646778055572080881341292116987136155397805421",
//                     time_created: Some(parse_datetime("2024-10-02 12:24:38")),
//                     block_created: Some(259606191),
//                     txid: Some("0xee543f496e3477c0959359b4e53fb3c79ce3f776fb1dd5cac4898c99fba826aa"),
//                 }];
//                 for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
//                     assert_vote(vote, expected);
//                 }
//             }
//             _ => panic!("Failed to index"),
//         }
//     }
// }
