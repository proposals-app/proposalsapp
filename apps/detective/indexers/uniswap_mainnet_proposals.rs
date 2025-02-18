use crate::{
    chain_data::{self},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
    transports::http::Http,
};
use alloy_chains::NamedChain;
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use proposalsapp_db::models::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
};
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    uniswap_gov,
    "./abis/uniswap_gov.json"
);

pub struct UniswapMainnetProposalsIndexer;

#[async_trait]
impl Indexer for UniswapMainnetProposalsIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::UniswapMainnetProposals
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for UniswapMainnetProposalsIndexer {
    #[instrument(skip_all)]
    async fn process_proposals(&self, indexer: &dao_indexer::Model, _dao: &dao::Model) -> Result<ProcessResult> {
        info!("Processing Uniswap Mainnet Proposals");

        let eth_rpc = chain_data::get_chain_config(NamedChain::Mainnet)?
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

        let address = address!("408ED6354d4973f66138C91495F2f2FCbd8724C3");

        let gov_contract = uniswap_gov::new(address, eth_rpc.clone());

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

#[instrument(skip_all)]
async fn data_for_proposal(p: (uniswap_gov::ProposalCreated, Log), rpc: &Arc<ReqwestProvider>, indexer: &dao_indexer::Model, gov_contract: uniswap_gov::uniswap_govInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>) -> Result<proposal::ActiveModel> {
    let (event, log): (uniswap_gov::ProposalCreated, Log) = p.clone();

    let created_block_number = log.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), BlockTransactionsKind::Hashes)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp = match chain_data::estimate_timestamp(NamedChain::Mainnet, voting_start_block_number).await {
        Ok(r) => r,
        Err(_) => {
            let fallback = DateTime::from_timestamp_millis((created_block_timestamp * 1000) + (voting_start_block_number as i64 - created_block_number as i64) * average_block_time_millis)
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

    let voting_ends_timestamp = match chain_data::estimate_timestamp(NamedChain::Mainnet, voting_end_block_number).await {
        Ok(r) => r,
        Err(_) => {
            let fallback = DateTime::from_timestamp_millis(created_block_timestamp * 1000 + (voting_end_block_number - created_block_number) as i64 * average_block_time_millis)
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

    let proposal_url = format!("https://app.uniswap.org/#/vote/{}", event.id);

    let proposal_external_id = event.id.to_string();

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
        .proposals(event.id)
        .call()
        .await
        .context("gov_contract.proposals")?;

    let scores = vec![
        proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorumVotes()
        .call()
        .await
        .context("gov_contract.quorum_votes")?
        ._0
        .to::<u128>() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract.state(event.id).call().await.map_or_else(
        |e| {
            warn!("Failed to get proposal state: {:?}", e);
            8 // Default value in case of error
        },
        |state| state._0,
    );

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
        block_created: Set(Some(created_block_number as i32)),
        created_at: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        start_at: Set(voting_starts_timestamp),
        end_at: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        metadata: Set(json!({"vote_type": "basic","quorum_choices":[0]}).into()),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

#[cfg(test)]
mod uniswap_mainnet_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use proposalsapp_db::models::{
        dao_indexer,
        sea_orm_active_enums::{IndexerType, IndexerVariant},
    };
    use sea_orm::prelude::Uuid;
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn uniswap_mainnet_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV3MainnetProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 20529031,
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

        match UniswapMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 20529031,
                    external_id: "67",
                    name: "Deploy Uniswap v3 on X Layer",
                    body_contains: Some(vec![
                        "This proposal proposes deploying Uniswap v3 on X Layer. GFX Labs is \
                         sponsoring this proposal on behalf of X Layer.",
                    ]),
                    url: "https://app.uniswap.org/#/vote/67",
                    discussion_url: None,
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([43618795.38760202, 9.554697539678713, 0.23141129971594382]),
                    scores_total: 43618805.17371086,
                    scores_quorum: 43618795.38760202,
                    quorum: 40000000.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-08-14 19:42:47"),
                    time_start: parse_datetime("2024-08-16 15:44:47"),
                    time_end: parse_datetime("2024-08-22 06:55:11"),
                    block_created: Some(20529031),
                    txid: Some("0x23ea669518d73d54f7cdb9320cd9b7408e086a84de2852652078ac813739c319"),
                    metadata: json!({"vote_type": "basic","quorum_choices":[0]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn uniswap_mainnet_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV3MainnetProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 13129515,
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

        match UniswapMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 13129516,
                    external_id: "1",
                    name: "\"\"",
                    body_contains: None,
                    url: "https://app.uniswap.org/#/vote/1",
                    discussion_url: None,
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([0.0, 0.0, 0.0]),
                    scores_total: 0.0,
                    scores_quorum: 0.0,
                    quorum: 40000000.0,
                    proposal_state: ProposalState::Unknown,
                    marked_spam: None,
                    time_created: parse_datetime("2021-08-30 22:16:12"),
                    time_start: parse_datetime("2021-09-01 23:09:37"),
                    time_end: parse_datetime("2021-09-08 04:43:51"),
                    block_created: Some(13129516),
                    txid: Some("0x52371bf3cc7dc7169203e70e2e914c31408021d38c6b44d8c8652099e2fa5c12"),
                    metadata: json!({"vote_type": "basic","quorum_choices":[0]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
