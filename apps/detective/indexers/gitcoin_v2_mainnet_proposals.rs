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
    gitcoin_v2_gov,
    "./abis/gitcoin_v2_gov.json"
);

pub struct GitcoinV2MainnetProposalsIndexer;

#[async_trait]
impl Indexer for GitcoinV2MainnetProposalsIndexer {
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
        IndexerVariant::GitcoinV2MainnetProposals
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for GitcoinV2MainnetProposalsIndexer {
    #[instrument(skip_all)]
    async fn process_proposals(&self, indexer: &dao_indexer::Model, _dao: &dao::Model) -> Result<ProcessResult> {
        info!("Processing Gitcoin V2 Proposals");

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

        let address = address!("9D4C63565D5618310271bF3F3c01b2954C1D1639");

        let gov_contract = gitcoin_v2_gov::new(address, eth_rpc.clone());

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
async fn data_for_proposal(p: (gitcoin_v2_gov::ProposalCreated, Log), rpc: &Arc<ReqwestProvider>, indexer: &dao_indexer::Model, gov_contract: gitcoin_v2_gov::gitcoin_v2_govInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>) -> Result<proposal::ActiveModel> {
    let (event, log): (gitcoin_v2_gov::ProposalCreated, Log) = p.clone();

    let created_block = rpc
        .get_block_by_number(
            log.block_number.unwrap().into(),
            BlockTransactionsKind::Hashes,
        )
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
            let fallback = DateTime::from_timestamp_millis((log.block_timestamp.unwrap() + (voting_start_block_number - log.block_number.unwrap()) * average_block_time_millis) as i64)
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
            let fallback = DateTime::from_timestamp_millis((log.block_timestamp.unwrap() + (voting_end_block_number - log.block_number.unwrap()) * average_block_time_millis) as i64)
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

    let proposal_url = format!(
        "https://www.tally.xyz/gov/gitcoin/proposal/{}",
        event.proposalId
    );

    let proposal_external_id = event.proposalId.to_string();

    let choices = vec!["For", "Against", "Abstain"];

    let proposal_votes = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposalVotes")?;

    let scores = vec![
        proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)) + proposal_votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorum(event.proposalId)
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
        created_at: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        start_at: Set(voting_starts_timestamp),
        end_at: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(log.block_number.unwrap().to_i32().unwrap()),
        metadata: Set(json!({"vote_type": "basic","quorum_choices":[0,2]}).into()),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

#[cfg(test)]
mod gitcoin_2_mainnet_proposals {
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
    async fn gitcoin_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 18290231,
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

        match GitcoinV2MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 18290231,
                    external_id: "83370444265186051506036240751499191729551923064564972278212022875236597720544",
                    name: "MMM S19 Budget Re-Post",
                    body_contains: None,
                    url: "https://www.tally.xyz/gov/gitcoin/proposal/83370444265186051506036240751499191729551923064564972278212022875236597720544",
                    discussion_url: None,
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([3394262.350150614, 646452.194172896, 1045320.5505893645]),
                    scores_total: 5086035.0949128745,
                    scores_quorum: 4439582.900739979,
                    quorum: 2500000.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2023-10-06 08:20:11"),
                    time_start: parse_datetime("2023-10-08 04:26:47"),
                    time_end: parse_datetime("2023-10-13 19:54:59"),
                    block_created: Some(18290231),
                    txid: Some("0x12d10cc283b53d9602fc77352518d922762566093a2ed40a2eb92fbdc9e906e7"),
                    metadata: json!({"vote_type": "basic","quorum_choices":[0,2]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
