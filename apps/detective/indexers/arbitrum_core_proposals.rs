use crate::indexer::Indexer;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use contracts::gen::arbitrum_core_gov::{
    arbitrum_core_gov::arbitrum_core_gov, ProposalCreatedFilter,
};
use ethers::{
    abi::Address,
    contract::LogMeta,
    providers::{Http, Middleware, Provider},
    types::U256,
};
use scanners::etherscan;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

pub struct ArbitrumCoreProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for ArbitrumCoreProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Arbitrum Core Proposals");

        let arb_rpc_url = std::env::var("ARBITRUM_NODE_URL").expect("Arbitrum node not set!");
        let arb_rpc = Arc::new(Provider::<Http>::try_from(arb_rpc_url).unwrap());

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")?
            .as_u32() as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = "0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = arbitrum_core_gov::new(address, arb_rpc.clone());

        let proposal_events = gov_contract
            .proposal_created_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &arb_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal")?;
            proposals.push(p);
        }

        Ok((proposals, Vec::new(), to_block))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (
        contracts::gen::arbitrum_core_gov::ProposalCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
    gov_contract: arbitrum_core_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?
        .context("bad block")?;

    let created_block_timestamp = created_block.timestamp.as_u64() as i64;
    let created_block_datetime = DateTime::<Utc>::from_timestamp(created_block_timestamp, 0)
        .context("bad timestamp")?
        .naive_utc();

    let created_block_ethereum = etherscan::estimate_block(created_block_timestamp as u64).await?;

    let voting_start_block_number = log.start_block.as_u64();
    let mut voting_end_block_number = log.end_block.as_u64();

    let gov_contract_end_block_number = gov_contract
        .proposal_deadline(log.proposal_id)
        .await?
        .as_u64();

    if gov_contract_end_block_number > voting_end_block_number {
        voting_end_block_number = gov_contract_end_block_number;
    }

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp =
        match etherscan::estimate_timestamp(voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => {
                let fallback = DateTime::from_timestamp_millis(
                    (created_block_timestamp * 1000)
                        + (voting_start_block_number as i64 - created_block_ethereum as i64)
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

    let voting_ends_timestamp = match etherscan::estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        Err(_) => {
            let fallback = DateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_end_block_number as i64 - created_block_ethereum as i64)
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

    let proposal_url = format!(
        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
        log.proposal_id
    );

    let proposal_external_id = log.proposal_id.to_string();

    let mut title = format!(
        "{:.120}",
        log.description
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

    let body = log.description.to_string();

    let onchain_proposal = gov_contract
        .proposal_votes(log.proposal_id)
        .call()
        .await
        .context("gov_contract.proposal_votes")?;

    let choices = vec!["For", "Against", "Abstain"];

    let scores = vec![
        onchain_proposal.1.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.0.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.2.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.1.as_u128() as f64 / (10.0f64.powi(18))
        + onchain_proposal.2.as_u128() as f64 / (10.0f64.powi(18));

    let proposal_snapshot_block = gov_contract
        .proposal_snapshot(log.proposal_id)
        .await
        .context(
            "gov_contract
        .proposal_snapshot",
        )?;

    let quorum = match gov_contract.quorum(proposal_snapshot_block).await {
        Ok(r) => r.as_u128() as f64 / (10.0f64.powi(18)),
        Err(_) => U256::from(0).as_u128() as f64 / (10.0f64.powi(18)),
    };

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .call()
        .await
        .context("gov_contract.state")?;

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
        flagged_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_datetime),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        metadata: NotSet,
        txid: Set(Some(format!("{:#x}", meta.transaction_hash))),
    })
}
