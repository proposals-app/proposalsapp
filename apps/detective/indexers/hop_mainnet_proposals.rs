use crate::{indexer::Indexer, rpc_providers};
use alloy::{
    primitives::{address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use chrono::DateTime;
use rust_decimal::prelude::ToPrimitive;
use scanners::etherscan::estimate_timestamp;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    hop_gov,
    "./abis/hop_gov.json"
);

pub struct HopMainnetProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for HopMainnetProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Hop Protocol Proposals");

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

        let address = address!("ed8Bdb5895B8B7f9Fdb3C087628FD8410E853D48");

        let gov_contract = hop_gov::new(address, eth_rpc.clone());

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

        Ok((proposals, Vec::new(), new_index))
    }

    fn min_refresh_speed(&self) -> i32 {
        1
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (hop_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: hop_gov::hop_govInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let (event, log): (hop_gov::ProposalCreated, Log) = p.clone();

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
        "https://app.hop.exchange/#/governance/proposal/{}",
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
        .context("gov_contract.proposalVotes")?;

    let scores = vec![
        proposal_votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        proposal_votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

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
