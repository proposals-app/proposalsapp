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
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    frax_alpha_gov,
    "./abis/frax_alpha_gov.json"
);

pub struct FraxAlphaMainnetProposalsIndexer;

#[async_trait]
impl Indexer for FraxAlphaMainnetProposalsIndexer {
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
impl ProposalsIndexer for FraxAlphaMainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Frax Alpha Proposals");

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

        let address = address!("e8Ab863E629a05c73D6a23b99d37027E3763156e");

        let gov_contract = frax_alpha_gov::new(address, eth_rpc.clone());

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
    p: (frax_alpha_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: frax_alpha_gov::frax_alpha_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (frax_alpha_gov::ProposalCreated, Log) = p.clone();

    let created_block = rpc
        .get_block_by_number(
            log.block_number.unwrap().into(),
            BlockTransactionsKind::Hashes,
        )
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_starts_timestamp =
        DateTime::from_timestamp_millis(event.voteStart.to::<i64>() * 1000)
            .unwrap()
            .naive_utc();

    let voting_ends_timestamp = DateTime::from_timestamp_millis(event.voteEnd.to::<i64>() * 1000)
        .unwrap()
        .naive_utc();

    let proposal_url = format!(
        "https://app.frax.finance/gov/frax/proposals/{}",
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

    let votes = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposalVotes")?;

    let scores = vec![
        votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

    let quorum = gov_contract
        .quorum(event.voteStart)
        .call()
        .await
        .context("gov_contract.quorum")?
        .quorumAtTimepoint
        .to::<u128>() as f64
        / (10.0f64.powi(18));

    let scores_quorum =
        (votes.forVotes + votes.abstainVotes).to::<u128>() as f64 / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(event.proposalId)
        .call()
        .await
        .context("gov_contract.state")?
        .proposalState;

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
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
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
mod frax_alpha_mainnet_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn frax_alpha_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 18423814,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
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

        match FraxAlphaMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 18423814,
                    external_id: "60708560165412810316461688580050204590455881433802935484090906527522033434551",
                    name: "Burn FXS (reject me)",
                    body_contains: Some(vec!["(reject me)"]),
                    url: "https://app.frax.finance/gov/frax/proposals/60708560165412810316461688580050204590455881433802935484090906527522033434551",
                    discussion_url: None,
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([0.0, 125542.27490011408, 0.0]),
                    scores_total: 125542.27490011408,
                    scores_quorum: 0.0,
                    quorum: 34757608.40675703,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-10-25 00:52:59"),
                    time_start: parse_datetime("2023-10-27 00:52:59"),
                    time_end: parse_datetime("2023-10-31 00:52:59"),
                    block_created: Some(18423814),
                    txid: Some("0x17cc0b9f3bcc2910f050eddc83bdc8764e59aea37cd815104254041fd44530f7"),
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
