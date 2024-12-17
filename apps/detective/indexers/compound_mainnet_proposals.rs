use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
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
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerType, ProposalState},
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    compound_gov,
    "./abis/compound_gov.json"
);

pub struct CompoundMainnetProposalsIndexer;

#[async_trait]
impl Indexer for CompoundMainnetProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Proposals
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for CompoundMainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Compound Proposals");

        let eth_rpc = chain_data::get_chain_config(Chain::Ethereum)?
            .provider
            .clone();

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

        let address = address!("c0Da02939E1441F497fd74F78cE7Decb17B66529");

        let gov_contract = compound_gov::new(address, eth_rpc.clone());

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
    p: (compound_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: compound_gov::compound_govInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let (event, log): (compound_gov::ProposalCreated, Log) = p.clone();

    let created_block = rpc
        .get_block_by_number(
            log.block_number.unwrap().into(),
            BlockTransactionsKind::Hashes,
        )
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

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Ethereum, voting_start_block_number).await {
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

    let proposal_url = format!("https://compound.finance/governance/proposals/{}", event.id);

    let proposal_external_id = event.id.to_string();

    let onchain_proposal = gov_contract
        .proposals(event.id)
        .call()
        .await
        .context("gov_contract.proposals")?;

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

    let scores = vec![
        onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorumVotes()
        .call()
        .await
        .context("gov_contract.quorumVotes")?
        ._0
        .to::<u128>() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(event.id)
        .call()
        .await
        .context("getProposalState")
        .map(|result| result._0)
        .unwrap_or(99); // default to Unknown

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

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        author: Set(Some(event.proposer.to_string())),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: NotSet,
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
mod compound_mainnet_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn compound_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::CompoundMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 12235671,
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

        match CompoundMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 12235671,
                    external_id: "43",
                    name: "Governance Analysis Period",
                    body_contains: Some(vec!["This would allow the community and developers additional time to audit new contracts and proposals for errors, and users the opportunity to move COMP or delegations prior to a vote commencing."]),
                    url: "https://compound.finance/governance/proposals/43",
                    discussion_url: "",
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([1367841.9649007607, 5000.0, 0.0]),
                    scores_total: 1372841.9649007607,
                    scores_quorum: 1367841.9649007607,
                    quorum: 399999.99999999994,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2021-04-14 03:00:21"),
                    time_start: parse_datetime("2021-04-14 03:00:23"),
                    time_end: parse_datetime("2021-04-16 19:13:09"),
                    block_created: Some(12235671),
                    txid: Some("0xe34419e8d64845b5fb920ce265d23c14def48de2bc09e4159fce5e09a819a56e"),
                    metadata: None,
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn compound_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::CompoundMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 20215251 - 20214270,
            index: 20214270,
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

        match CompoundMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [
                    ExpectedProposal {
                        index_created: 20214270,
                        external_id: "271",
                        name: "[Gauntlet] - WETH Arbitrum v3 Global Param Updates",
                        body_contains: Some(vec!["Gauntlet recommends to adjust these params to match the setting on Base WETH Comet. The adjustment to lower BASE Borrow Min will allow users to borrow lower amounts of WETH and Base Min Rewards the adjustment will allow the incentives to kick off earlier within the market."]),
                        url: "https://compound.finance/governance/proposals/271",
                        discussion_url: "",
                        choices: json!(["For", "Against", "Abstain"]),
                        scores: json!([381721.9323550018, 0.0, 50007.948335668865]),
                        scores_total: 431729.8806906707,
                        scores_quorum: 381721.9323550018,
                        quorum: 399999.99999999994,
                        proposal_state: ProposalState::Defeated,
                        marked_spam: None,
                        time_created: parse_datetime("2024-07-01 21:10:47"),
                        time_start: parse_datetime("2024-07-03 17:15:35"),
                        time_end: parse_datetime("2024-07-06 11:18:59"),
                        block_created: Some(20214270),
                        txid: Some("0x486fa2537df83e619f600d4da86955c571715f4816199573b1add1e101a9ee7d"),
                        metadata: None,
                    },
                    ExpectedProposal {
                        index_created: 20215251,
                        external_id: "272",
                        name: "[Gauntlet] Polygon USDC.e and Scroll USDC - Risk and Incentive Recommendations",
                        body_contains: Some(vec!["Gauntlet recommends adjusting Polygon USDC.e Comet's supply caps to risk off under utilized caps and reducing incentives to account for the higher costs per USDC.e within the protocol."]),
                        url: "https://compound.finance/governance/proposals/272",
                        discussion_url: "",
                        choices: json!(["For", "Against", "Abstain"]),
                        scores: json!([475671.1200245885, 0.0, 0.0]),
                        scores_total: 475671.1200245885,
                        scores_quorum: 475671.1200245885,
                        quorum: 399999.99999999994,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2024-07-02 00:27:59"),
                        time_start: parse_datetime("2024-07-03 20:31:59"),
                        time_end: parse_datetime("2024-07-06 14:35:47"),
                        block_created: Some(20215251),
                        txid: Some("0x17bab3c0096c127192d4da5af370b216d5cb3fe5c700c7d409421ea26f50b890"),
                        metadata: None,
                    }
                ];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn compound_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::CompoundMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 20355844,
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

        match CompoundMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 20355844,
                    external_id: "284",
                    name: "Add wstETH as collateral into cUSDCv3 on Optimism",
                    body_contains: Some(vec!["Compound Growth Program [AlphaGrowth] proposes to add wstETH into cUSDCv3 on Optimism network."]),
                    url: "https://compound.finance/governance/proposals/284",
                    discussion_url: "",
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([560578.7289136582, 0.0, 0.0]),
                    scores_total: 560578.7289136582,
                    scores_quorum: 560578.7289136582,
                    quorum: 399999.99999999994,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-07-21 15:35:59"),
                    time_start: parse_datetime("2024-07-23 11:38:35"),
                    time_end: parse_datetime("2024-07-26 05:40:47"),
                    block_created: Some(20355844),
                    txid: Some("0xdbf9ea5cd4404d9e47f5aa1f61701f6f83af7f6e619efcc578ac7340aedeac3e"),
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
