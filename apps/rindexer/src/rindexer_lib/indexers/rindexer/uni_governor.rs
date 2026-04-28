#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::uni_governor::{
    ProposalCreatedData, ProposalCreatedEvent, ProposalExecutedEvent, UniGovernorEventType,
    VoteCastData, VoteCastEvent, no_extensions,
};
use super::contracts::uni_governor_contract;
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{
            DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB,
            calculate_total_delegated_voting_power, store_proposal, store_votes,
        },
    },
    rindexer_lib::typings::networks::get_ethereum_provider,
};
use alloy::{
    hex::ToHexExt,
    primitives::{B256, Bytes, U256},
    providers::Provider,
    sol_types::SolEvent,
};
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use futures::{StreamExt, stream};
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use rindexer::{
    EthereumSqlTypeWrapper, PgType, PostgresClient, RindexerColorize,
    event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus,
    rindexer_error,
};
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{self, NotSet},
    ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QuerySelect, Set,
    prelude::Uuid,
};
use serde::Deserialize;
use serde_json::json;
use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::Arc,
};
use tracing::{debug, error, info, instrument, warn};

fn get_governor_id() -> Option<Uuid> {
    DAO_SLUG_GOVERNOR_TYPE_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("uniswap")
        .unwrap()
        .get("UNISWAP_GOVERNOR")
        .copied()
}

fn get_dao_id() -> Option<Uuid> {
    DAO_SLUG_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("uniswap")
        .copied()
}

const CONCURRENCY_LIMIT: usize = 100;
const LOG_BLOCK_RANGE: u64 = 9_999;
const MAX_PROPOSAL_LOG_LOOKBACK_BLOCKS: u64 = 60_000;
const LOG_LOOKAROUND_BLOCKS: u64 = 8;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RpcLog {
    block_number: String,
    transaction_hash: String,
    data: String,
    topics: Vec<String>,
}

#[derive(Debug, Clone)]
struct DecodedProposalCreatedLog {
    event_data: ProposalCreatedData,
    block_number: u64,
    transaction_hash: String,
}

#[derive(Debug, Clone)]
struct DecodedVoteCastLog {
    event_data: VoteCastData,
    block_number: u64,
    transaction_hash: String,
}

fn proposal_state_from_contract(state_code: u8) -> ProposalState {
    match state_code {
        0 => ProposalState::Pending,
        1 => ProposalState::Active,
        2 => ProposalState::Canceled,
        3 => ProposalState::Defeated,
        4 => ProposalState::Succeeded,
        5 => ProposalState::Queued,
        6 => ProposalState::Expired,
        7 => ProposalState::Executed,
        _ => ProposalState::Unknown,
    }
}

fn vote_choice_from_support(support: u8) -> serde_json::Value {
    match support {
        0 => 1.into(),
        1 => 0.into(),
        2 => 2.into(),
        _ => 2.into(),
    }
}

fn parse_hex_u64(value: &str) -> Result<u64> {
    u64::from_str_radix(value.trim_start_matches("0x"), 16)
        .context("Failed to parse hex value into u64")
}

async fn build_proposal_model_from_event(
    event_data: &ProposalCreatedData,
    block_number: u64,
    transaction_hash: &str,
    proposal_state: ProposalState,
) -> Result<proposal::ActiveModel> {
    let created_at = estimate_timestamp("ethereum", block_number)
        .await
        .context("Failed to estimate proposal created_at timestamp")?;
    let start_at = estimate_timestamp("ethereum", event_data.startBlock.to::<u64>())
        .await
        .context("Failed to estimate proposal start_at timestamp")?;
    let end_at = estimate_timestamp("ethereum", event_data.endBlock.to::<u64>())
        .await
        .context("Failed to estimate proposal end_at timestamp")?;

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(event_data.id.to_string()),
        name: Set(extract_title(&event_data.description)),
        body: Set(event_data.description.clone()),
        url: Set(format!(
            "https://www.tally.xyz/gov/uniswap/proposal/{}",
            event_data.id
        )),
        discussion_url: NotSet,
        choices: Set(json!(["For", "Against", "Abstain"])),
        quorum: Set(4_000_000.0),
        proposal_state: Set(proposal_state),
        marked_spam: NotSet,
        created_at: Set(created_at),
        start_at: Set(start_at),
        end_at: Set(end_at),
        block_created_at: Set(Some(block_number as i32)),
        block_start_at: Set(Some(event_data.startBlock.to::<u64>() as i32)),
        block_end_at: Set(Some(event_data.endBlock.to::<u64>() as i32)),
        metadata: Set(json!({
            "vote_type": "basic",
            "quorum_choices": [0, 1],
            "total_delegated_vp": calculate_total_delegated_vp(created_at).await.unwrap_or(0.0),
            "targets": event_data.targets,
            "values": event_data.values,
            "calldatas": event_data.calldatas,
            "signatures": event_data.signatures,
        })
        .into()),
        txid: Set(Some(transaction_hash.to_string())),
        governor_id: Set(get_governor_id().unwrap()),
        dao_id: Set(get_dao_id().unwrap()),
        author: Set(Some(event_data.proposer.to_string())),
    })
}

async fn build_vote_model_from_event(
    event_data: &VoteCastData,
    block_number: u64,
    transaction_hash: &str,
    governor_id: Uuid,
) -> Option<vote::ActiveModel> {
    let created_at = match estimate_timestamp("ethereum", block_number).await {
        Ok(ts) => ts,
        Err(e) => {
            error!(
                proposal_id = %event_data.proposalId,
                block_number = block_number,
                error = %e,
                "Failed to estimate created_at timestamp for VoteCast event"
            );
            return None;
        }
    };

    Some(vote::ActiveModel {
        id: NotSet,
        voter_address: Set(event_data.voter.to_string()),
        choice: Set(vote_choice_from_support(event_data.support)),
        voting_power: Set((event_data.votes.to::<u128>() as f64) / (10.0f64.powi(18))),
        reason: Set(if event_data.reason.is_empty() {
            None
        } else {
            Some(event_data.reason.clone())
        }),
        created_at: Set(created_at),
        block_created_at: Set(Some(block_number as i32)),
        txid: Set(Some(transaction_hash.to_string())),
        proposal_external_id: Set(event_data.proposalId.to_string()),
        proposal_id: NotSet,
        governor_id: Set(governor_id),
        dao_id: Set(get_dao_id().unwrap()),
    })
}

async fn fetch_uni_governor_logs(
    topic_id: &str,
    from_block: u64,
    to_block: u64,
) -> Result<Vec<RpcLog>> {
    let provider = get_ethereum_provider().await;

    provider
        .client()
        .request::<(serde_json::Value,), Vec<RpcLog>>(
            "eth_getLogs",
            (json!({
                "address": "0x408ed6354d4973f66138c91495f2f2fcbd8724c3",
                "topics": [topic_id],
                "fromBlock": format!("0x{:x}", from_block),
                "toBlock": format!("0x{:x}", to_block),
            }),),
        )
        .await
        .context("Failed to fetch UniGovernor logs")
}

fn decode_proposal_created_log(log: RpcLog) -> Result<DecodedProposalCreatedLog> {
    let topics = log
        .topics
        .into_iter()
        .map(|topic| topic.parse::<B256>().context("Invalid log topic"))
        .collect::<Result<Vec<_>>>()?;
    let data = log
        .data
        .parse::<Bytes>()
        .context("Invalid proposal created log data")?;
    let event_data = ProposalCreatedData::decode_raw_log(topics, &data[..])
        .context("Failed to decode ProposalCreated log")?;

    Ok(DecodedProposalCreatedLog {
        event_data,
        block_number: parse_hex_u64(&log.block_number)?,
        transaction_hash: log.transaction_hash,
    })
}

fn decode_vote_cast_log(log: RpcLog) -> Result<DecodedVoteCastLog> {
    let topics = log
        .topics
        .into_iter()
        .map(|topic| topic.parse::<B256>().context("Invalid log topic"))
        .collect::<Result<Vec<_>>>()?;
    let data = log
        .data
        .parse::<Bytes>()
        .context("Invalid vote cast log data")?;
    let event_data =
        VoteCastData::decode_raw_log(topics, &data[..]).context("Failed to decode VoteCast log")?;

    Ok(DecodedVoteCastLog {
        event_data,
        block_number: parse_hex_u64(&log.block_number)?,
        transaction_hash: log.transaction_hash,
    })
}

async fn find_missing_proposal_created_log(
    proposal_id: U256,
    start_block: u64,
) -> Result<Option<DecodedProposalCreatedLog>> {
    let search_floor = start_block.saturating_sub(MAX_PROPOSAL_LOG_LOOKBACK_BLOCKS);
    let mut search_to = start_block.saturating_add(LOG_LOOKAROUND_BLOCKS);

    loop {
        let search_from = search_to.saturating_sub(LOG_BLOCK_RANGE);
        let logs = fetch_uni_governor_logs(
            "0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0",
            search_from,
            search_to,
        )
        .await?;

        for log in logs {
            let decoded = decode_proposal_created_log(log)?;
            if decoded.event_data.id == proposal_id {
                return Ok(Some(decoded));
            }
        }

        if search_from <= search_floor || search_from == 0 {
            break;
        }

        search_to = search_from.saturating_sub(1);
    }

    Ok(None)
}

async fn fetch_vote_cast_logs_for_proposal(
    proposal_id: U256,
    start_block: u64,
    end_block: u64,
) -> Result<Vec<DecodedVoteCastLog>> {
    let mut decoded_logs = Vec::new();
    let mut chunk_start = start_block;

    while chunk_start <= end_block {
        let chunk_end = chunk_start.saturating_add(LOG_BLOCK_RANGE).min(end_block);
        let logs = fetch_uni_governor_logs(
            "0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4",
            chunk_start,
            chunk_end,
        )
        .await?;

        for log in logs {
            let decoded = decode_vote_cast_log(log)?;
            if decoded.event_data.proposalId == proposal_id {
                decoded_logs.push(decoded);
            }
        }

        if chunk_end == end_block {
            break;
        }

        chunk_start = chunk_end.saturating_add(1);
    }

    Ok(decoded_logs)
}

#[instrument(
    name = "uni_governor_proposal_created_handler",
    skip(manifest_path, registry)
)]
async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    UniGovernorEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ProposalCreated events to process in this batch.");
                    return Ok(());
                }

                info!(
                    event_name = "UniGovernor::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ProposalCreated events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.id;
                    let block_number = result.tx_information.block_number;

                    let uni_governor = uni_governor_contract("ethereum").await;

                    let proposal_state_result = uni_governor.state(proposal_id).call().await;
                    let proposal_state = match proposal_state_result {
                        Ok(state_enum) => proposal_state_from_contract(state_enum),
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to fetch proposal state from contract, defaulting to Unknown");
                            ProposalState::Unknown
                        }
                    };

                    let proposal = match build_proposal_model_from_event(
                        &result.event_data,
                        block_number,
                        &result.tx_information.transaction_hash.to_string(),
                        proposal_state,
                    )
                    .await
                    {
                        Ok(proposal) => proposal,
                        Err(e) => {
                            error!(
                                proposal_id = %proposal_id,
                                block_number = block_number,
                                error = %e,
                                "Failed to build proposal model from ProposalCreated event"
                            );
                            continue;
                        }
                    };

                    if let Err(e) = store_proposal(proposal).await {
                        error!(proposal_id = %proposal_id, error = %e, "Failed to store proposal");
                    } else {
                        debug!(proposal_id = %proposal_id, external_id = %result.event_data.id, "Proposal stored");
                    }
                }


                info!(
                    event_name = "UniGovernor::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ProposalCreated events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(
    name = "uni_governor_proposal_executed_handler",
    skip(manifest_path, registry)
)]
async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    UniGovernorEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ProposalExecuted events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "UniGovernor::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ProposalExecuted events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.id;
                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        quorum: NotSet,
                        proposal_state: Set(ProposalState::Executed),
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: NotSet,
                        block_created_at: NotSet,
                        block_start_at: NotSet,
                        block_end_at: NotSet,
                        metadata: NotSet,
                        txid: NotSet,
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: NotSet,
                    };

                    if let Err(e) = store_proposal(proposal).await {
                        error!(proposal_id = %proposal_id, error = %e, "Failed to update proposal state to Executed");
                    } else {
                        debug!(proposal_id = %proposal_id, external_id = %result.event_data.id, "Proposal state updated to Executed");
                    }
                }
                info!(
                    event_name = "UniGovernor::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ProposalExecuted events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(name = "uni_governor_vote_cast_handler", skip(manifest_path, registry))]
async fn vote_cast_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    UniGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No VoteCast events to process in this batch.");
                    return Ok(());
                }

                let results_len = results.len();
                info!(
                    event_name = "UniGovernor::VoteCast",
                    event_count = results_len,
                    status = "INDEXING",
                    "Processing VoteCast events"
                );
                let governor_id_for_votes = get_governor_id().unwrap();

                let votes: Vec<vote::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        build_vote_model_from_event(
                            &result.event_data,
                            result.tx_information.block_number,
                            &result.tx_information.transaction_hash.to_string(),
                            governor_id_for_votes,
                        )
                        .await
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .filter_map(|vote_opt| async { vote_opt }) // Filter out None values
                    .collect::<Vec<_>>()
                    .await;

                if let Err(e) = store_votes(votes, governor_id_for_votes).await {
                    error!(error = %e, "Failed to store votes");
                }

                info!(
                    event_name = "UniGovernor::VoteCast",
                    event_count = results_len,
                    status = "INDEXED",
                    "VoteCast events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(name = "uni_governor_handlers", skip(manifest_path, registry))]
pub async fn uni_governor_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    proposal_created_handler(manifest_path, registry).await;
    proposal_executed_handler(manifest_path, registry).await;
    vote_cast_handler(manifest_path, registry).await;
    info!("Uniswap Governor handlers registered.");
}

fn extract_title(description: &str) -> String {
    let mut lines = description
        .split('\n')
        .filter(|line| !line.trim().is_empty());

    // Try to find the first non-empty line that isn't just "#" markers
    let title = lines
        .find(|line| {
            let trimmed = line.trim_start_matches('#').trim();
            !trimmed.is_empty()
        })
        .unwrap_or("Unknown")
        .trim_start_matches('#')
        .trim()
        .to_string();

    // Truncate to 120 chars if needed
    if title.len() > 120 {
        title.chars().take(120).collect()
    } else {
        title
    }
}

#[instrument(name = "uni_governor_backfill_missing_proposals", skip_all)]
pub async fn backfill_missing_proposals_and_votes() -> Result<()> {
    let db = DB.get().context("DB not initialized")?;
    let governor_id = get_governor_id().context("Failed to get Uniswap governor ID")?;
    let uni_governor = uni_governor_contract("ethereum").await;

    let proposal_count = uni_governor
        .proposalCount()
        .call()
        .await
        .context("Failed to fetch Uniswap proposalCount")?
        .to::<u64>();

    let existing_ids: HashSet<u64> = proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .select_only()
        .column(proposal::Column::ExternalId)
        .into_tuple::<String>()
        .all(db)
        .await
        .context("Failed to fetch existing Uniswap proposal IDs")?
        .into_iter()
        .filter_map(|external_id| external_id.parse::<u64>().ok())
        .collect();

    let missing_ids: Vec<u64> = (1..=proposal_count)
        .filter(|proposal_id| !existing_ids.contains(proposal_id))
        .collect();

    if missing_ids.is_empty() {
        return Ok(());
    }

    warn!(
        governor = "UNISWAP_GOVERNOR",
        proposal_count = proposal_count,
        missing_ids = ?missing_ids,
        "Detected missing Uniswap proposals in the database; starting targeted backfill"
    );

    for proposal_id in missing_ids {
        let proposal_state = match uni_governor.state(U256::from(proposal_id)).call().await {
            Ok(state) => proposal_state_from_contract(state),
            Err(error) => {
                error!(
                    governor = "UNISWAP_GOVERNOR",
                    proposal_id = proposal_id,
                    error = %error,
                    "Failed to fetch proposal state for backfill"
                );
                continue;
            }
        };

        let proposal_details = match uni_governor.proposals(U256::from(proposal_id)).call().await {
            Ok(details) => details,
            Err(error) => {
                error!(
                    governor = "UNISWAP_GOVERNOR",
                    proposal_id = proposal_id,
                    error = %error,
                    "Failed to fetch proposal struct for backfill"
                );
                continue;
            }
        };

        let Some(proposal_created_log) = find_missing_proposal_created_log(
            U256::from(proposal_id),
            proposal_details.startBlock.to::<u64>(),
        )
        .await?
        else {
            error!(
                governor = "UNISWAP_GOVERNOR",
                proposal_id = proposal_id,
                start_block = proposal_details.startBlock.to::<u64>(),
                "Failed to locate ProposalCreated log for missing proposal"
            );
            continue;
        };

        let proposal_model = match build_proposal_model_from_event(
            &proposal_created_log.event_data,
            proposal_created_log.block_number,
            &proposal_created_log.transaction_hash,
            proposal_state,
        )
        .await
        {
            Ok(model) => model,
            Err(error) => {
                error!(
                    governor = "UNISWAP_GOVERNOR",
                    proposal_id = proposal_id,
                    error = %error,
                    "Failed to build missing proposal model"
                );
                continue;
            }
        };

        if let Err(error) = store_proposal(proposal_model).await {
            error!(
                governor = "UNISWAP_GOVERNOR",
                proposal_id = proposal_id,
                error = %error,
                "Failed to store missing Uniswap proposal"
            );
            continue;
        }

        let vote_logs = fetch_vote_cast_logs_for_proposal(
            U256::from(proposal_id),
            proposal_created_log.event_data.startBlock.to::<u64>(),
            proposal_created_log.event_data.endBlock.to::<u64>(),
        )
        .await
        .with_context(|| format!("Failed to fetch vote logs for missing proposal {proposal_id}"))?;
        let vote_count = vote_logs.len();

        let votes: Vec<vote::ActiveModel> = stream::iter(vote_logs)
            .map(|vote_log| async move {
                build_vote_model_from_event(
                    &vote_log.event_data,
                    vote_log.block_number,
                    &vote_log.transaction_hash,
                    governor_id,
                )
                .await
            })
            .buffer_unordered(CONCURRENCY_LIMIT)
            .filter_map(|vote| async move { vote })
            .collect()
            .await;

        if !votes.is_empty() {
            store_votes(votes, governor_id).await.with_context(|| {
                format!("Failed to store votes for missing proposal {proposal_id}")
            })?;
        }

        info!(
            governor = "UNISWAP_GOVERNOR",
            proposal_id = proposal_id,
            vote_count = vote_count,
            "Backfilled missing Uniswap proposal and associated votes"
        );
    }

    Ok(())
}

#[instrument(name = "uni_governor_update_active_proposals_end_time", skip_all)]
pub async fn update_active_proposals_end_time() -> Result<()> {
    let db = DB.get().unwrap();

    // Get all active proposals for this governor
    let active_proposals = proposal::Entity::find()
        .filter(
            proposal::Column::GovernorId
                .eq(get_governor_id().context("Failed to get governor ID")?),
        )
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .all(db)
        .await
        .context("Failed to fetch active proposals")?;

    if active_proposals.is_empty() {
        return Ok(());
    }

    info!(
        governor = "UNISWAP_GOVERNOR",
        active_proposals_count = active_proposals.len(),
        "Updating end times for active proposals"
    );

    for proposal in active_proposals {
        let proposal_id = proposal.external_id.clone();

        let block_start_at = match proposal.block_start_at {
            Some(block) => block as u64,
            None => {
                error!(proposal_id = %proposal_id, "Missing block_start_at for proposal");
                continue;
            }
        };

        let block_end_at = match proposal.block_end_at {
            Some(block) => block as u64,
            None => {
                error!(proposal_id = %proposal_id, "Missing block_end_at for proposal");
                continue;
            }
        };

        // Re-fetch the times on the block
        let new_start_at = match estimate_timestamp("ethereum", block_start_at).await {
            Ok(ts) => ts,
            Err(e) => {
                error!(proposal_id = %proposal_id, block_number = block_start_at, error = %e, "Failed to estimate new start_at timestamp");
                continue;
            }
        };
        let new_end_at = match estimate_timestamp("ethereum", block_end_at).await {
            Ok(ts) => ts,
            Err(e) => {
                error!(proposal_id = %proposal_id, block_number = block_end_at, error = %e, "Failed to estimate new end_at timestamp");
                continue;
            }
        };

        // Only update times changed
        if new_end_at != proposal.end_at || new_start_at != proposal.start_at {
            debug!(
                proposal_id = %proposal_id,
                old_end_at = ?proposal.end_at,
                new_end_at = ?new_end_at,
                old_start_at = ?proposal.start_at,
                new_start_at = ?new_start_at,
                "Updating proposal times"
            );

            // Update the proposal with the new times
            let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
            proposal_active_model.end_at = Set(new_end_at);
            proposal_active_model.start_at = Set(new_start_at);

            if let Err(e) = proposal_active_model.update(db).await {
                error!(proposal_id = %proposal_id, error = %e, "Failed to update proposal times");
            }
        }
    }

    info!(
        governor = "UNISWAP_GOVERNOR",
        "Successfully updated end times for active proposals"
    );

    Ok(())
}

#[instrument(name = "uni_governor_update_ended_proposals_state", skip_all)]
pub async fn update_ended_proposals_state() -> Result<()> {
    info!(
        governor = "UNISWAP_GOVERNOR",
        "Running task to update ended proposal states"
    );
    let db = DB.get().context("DB not initialized")?;

    let active_proposals = proposal::Entity::find()
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .filter(proposal::Column::EndAt.lt(chrono::Utc::now().naive_utc()))
        .filter(
            proposal::Column::GovernorId
                .eq(get_governor_id().context("Failed to get governor ID")?),
        )
        .all(db)
        .await
        .context("Failed to fetch ended active proposals")?;

    if active_proposals.is_empty() {
        info!(
            governor = "UNISWAP_GOVERNOR",
            "No active proposals have ended"
        );
        return Ok(());
    }

    info!(
        governor = "UNISWAP_GOVERNOR",
        proposal_count = active_proposals.len(),
        "Processing ended proposals"
    );

    for proposal in active_proposals {
        info!(
            governor = "UNISWAP_GOVERNOR",
            proposal_id = proposal.external_id,
            proposal_name = proposal.name,
            proposal_end_at = ?proposal.end_at,
            "Proposal end time reached. Calculating final state."
        );

        let votes = vote::Entity::find()
            .filter(vote::Column::ProposalId.eq(proposal.id))
            .all(db)
            .await
            .context("Failed to fetch votes for proposal")?;

        let final_state = calculate_final_proposal_state(&proposal, &votes).await?;

        let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
        proposal_active_model.proposal_state = Set(final_state.clone());
        proposal::Entity::update(proposal_active_model)
            .exec(db)
            .await
            .context("Failed to update proposal state")?;

        info!(
            governor = "UNISWAP_GOVERNOR",
            proposal_id = proposal.external_id,
            proposal_name = proposal.name,
            final_state = ?final_state,
            "Proposal state updated to final state."
        );
    }

    info!(
        governor = "UNISWAP_GOVERNOR",
        "Task to update ended proposals state completed."
    );
    Ok(())
}

#[instrument(name = "uni_governor_calculate_final_proposal_state", skip(proposal, votes), fields(proposal_id = proposal.external_id))]
async fn calculate_final_proposal_state(
    proposal: &proposal::Model,
    votes: &Vec<vote::Model>,
) -> Result<ProposalState> {
    let mut for_votes = 0.0;
    let mut against_votes = 0.0;

    let choices_value = proposal.choices.clone();
    let choices_vec: Vec<String> =
        serde_json::from_value(choices_value.clone()).unwrap_or_else(|_| vec![]);

    let mut choice_map: HashMap<usize, String> = HashMap::new();
    for (index, choice_text) in choices_vec.iter().enumerate() {
        let lower_choice = choice_text.to_lowercase();
        if lower_choice.contains("for") {
            choice_map.insert(index, "for".to_string());
        } else if lower_choice.contains("against") {
            choice_map.insert(index, "against".to_string());
        } else if lower_choice.contains("abstain") {
            choice_map.insert(index, "abstain".to_string());
        } else {
            choice_map.insert(index, "unknown".to_string()); // Default case
        }
    }

    for vote in votes {
        match vote.choice.as_u64() {
            Some(choice_index) => {
                match choice_map.get(&(choice_index as usize)).map(|s| s.as_str()) {
                    Some("for") => for_votes += vote.voting_power,
                    Some("against") => against_votes += vote.voting_power,
                    Some(_) | None => {
                        debug!(
                            proposal_id = proposal.external_id,
                            choice_index = choice_index,
                            "Unknown choice type at index for proposal"
                        );
                    }
                }
            }
            None => {
                error!(
                    proposal_id = proposal.external_id,
                    "Vote choice is not a valid u64 for proposal"
                );
            }
        }
    }
    debug!(
        proposal_id = proposal.external_id,
        for_votes = for_votes,
        against_votes = against_votes,
        "Vote counts aggregated."
    );

    let mut quorum_votes = 0.0;
    let metadata_value = proposal.metadata.clone();
    let metadata = metadata_value.unwrap_or_default();

    let quorum_choices_value = metadata.get("quorum_choices");
    let quorum_choices_indexes: Vec<usize> = match quorum_choices_value {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_u64().map(|u| u as usize))
            .collect(),
        _ => {
            debug!(
                proposal_id = proposal.external_id,
                "quorum_choices not found or not an array in metadata, defaulting to [0, 1] (For and Against)."
            );
            vec![0, 1] // Default to For and Against if not configured
        }
    };

    for vote in votes.iter().filter(|vote| {
        vote.choice
            .as_u64()
            .is_some_and(|choice_index| quorum_choices_indexes.contains(&(choice_index as usize)))
    }) {
        quorum_votes += vote.voting_power;
    }

    let quorum = proposal.quorum;
    debug!(
        proposal_id = proposal.external_id,
        quorum_votes = quorum_votes,
        required_quorum = quorum,
        "Quorum votes calculated."
    );

    if quorum_votes >= quorum && for_votes > against_votes {
        info!(
            proposal_id = proposal.external_id,
            for_votes = for_votes,
            against_votes = against_votes,
            quorum_votes = quorum_votes,
            required_quorum = quorum,
            "Proposal Succeeded: For votes exceed against votes and quorum is met."
        );
        Ok(ProposalState::Succeeded)
    } else {
        info!(
            proposal_id = proposal.external_id,
            for_votes = for_votes,
            against_votes = against_votes,
            quorum_votes = quorum_votes,
            required_quorum = quorum,
            "Proposal Defeated: For votes did not exceed against votes or quorum not met."
        );
        Ok(ProposalState::Defeated)
    }
}

/// Uniswap excluded voter address (Uniswap timelock contract)
const UNISWAP_EXCLUDED_VOTER: &str = "0x1a9C8182C09F50C8318d769245beA52c32BE35BC";

#[instrument(name = "uni_governor_calculate_total_delegated_vp", skip(timestamp), fields(timestamp = ?timestamp))]
async fn calculate_total_delegated_vp(timestamp: NaiveDateTime) -> Result<f64> {
    calculate_total_delegated_voting_power(timestamp, UNISWAP_EXCLUDED_VOTER).await
}
