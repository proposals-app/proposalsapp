use crate::{indexer::Indexer, rpc_providers};
use alloy::{
    primitives::address,
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
    nouns_proposals_gov,
    "./abis/nouns_proposals_gov.json"
);

pub struct NounsMainnetProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for NounsMainnetProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Nouns Proposals");

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

        let address = address!("6f3E6272A167e8AcCb32072d08E0957F9c79223d");

        let gov_contract = nouns_proposals_gov::new(address, eth_rpc.clone());

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
    p: (nouns_proposals_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: nouns_proposals_gov::nouns_proposals_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (nouns_proposals_gov::ProposalCreated, Log) = p.clone();

    let created_block_number = log.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), false)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        Err(_) => {
            let fallback = DateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64)
                        * average_block_time_millis,
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
                created_block_timestamp * 1000
                    + (voting_end_block_number - created_block_number) as i64
                        * average_block_time_millis,
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

    let proposal_url = format!("https://nouns.wtf/vote/{}", event.id);

    let proposal_external_id = event.id.to_string();

    let onchain_proposal = gov_contract
        .proposals(event.id)
        .call()
        .await
        .context("gov_contract.proposals")?
        ._0;

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
        onchain_proposal.forVotes.to::<u128>() as f64,
        onchain_proposal.againstVotes.to::<u128>() as f64,
        onchain_proposal.abstainVotes.to::<u128>() as f64,
    ];

    let scores_total: f64 = scores.iter().sum();

    let quorum = onchain_proposal.quorumVotes.to::<u128>() as f64;

    let scores_quorum = onchain_proposal.forVotes.to::<u128>() as f64
        + onchain_proposal.againstVotes.to::<u128>() as f64;

    let proposal_state = gov_contract
        .state(event.id)
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
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        metadata: NotSet,
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}
