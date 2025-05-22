#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_treasury_governor::{ArbitrumTreasuryGovernorEventType, ProposalCreatedEvent, ProposalExecutedEvent, ProposalExtendedEvent, VoteCastEvent, no_extensions};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB, store_proposal, store_votes},
    },
    rindexer_lib::typings::rindexer::events::arbitrum_treasury_governor::arbitrum_treasury_governor_contract,
};
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use ethers::{
    types::U256,
    utils::{hex::ToHex, to_checksum},
};
use futures::{StreamExt, stream};
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use rindexer::{EthereumSqlTypeWrapper, PgType, RindexerColorize, event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus, rindexer_error};
use sea_orm::{
    ActiveValue::{self, NotSet},
    ConnectionTrait, Set,
    prelude::Uuid,
};
use serde_json::json;
use std::{path::PathBuf, sync::Arc};
use tracing::{debug, error, info, instrument};

fn get_governor_id() -> Option<Uuid> {
    DAO_SLUG_GOVERNOR_TYPE_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .unwrap()
        .get("ARBITRUM_TREASURY")
        .copied()
}

fn get_dao_id() -> Option<Uuid> {
    DAO_SLUG_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .copied()
}

const CONCURRENCY_LIMIT: usize = 100;

#[instrument(
    name = "arbitrum_treasury_governor_proposal_created_handler",
    skip(manifest_path, registry)
)]
async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor ProposalCreated events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::ProposalCreated events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
                    let block_number = result.tx_information.block_number.to::<u64>();
                    let arbitrum_treasury_governor = arbitrum_treasury_governor_contract("arbitrum").await;

                    let created_at = match estimate_timestamp("arbitrum", block_number).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, block_number = block_number, error = %e, "Failed to estimate created_at timestamp");
                            continue; // Skip proposal if timestamp estimation fails
                        }
                    };

                    let start_at = match estimate_timestamp("ethereum", result.event_data.startBlock.to::<u64>()).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, block_number = block_number, error = %e, start_block = %result.event_data.startBlock, "Failed to estimate start_at timestamp");
                            continue;
                        }
                    };

                    let end_at = match estimate_timestamp("ethereum", result.event_data.endBlock.to::<u64>()).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, block_number = block_number, error = %e, end_block = %result.event_data.endBlock, "Failed to estimate end_at timestamp");
                            continue;
                        }
                    };

                    let title = extract_title(&result.event_data.description);
                    let proposal_url = format!(
                        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
                        proposal_id
                    );
                    let choices = vec!["For", "Against", "Abstain"];

                    let proposal_state_result = arbitrum_treasury_governor.state(proposal_id).call().await;
                    let proposal_state = match proposal_state_result {
                        Ok(state_enum) => match state_enum {
                            0 => ProposalState::Pending,
                            1 => ProposalState::Active,
                            2 => ProposalState::Canceled,
                            3 => ProposalState::Defeated,
                            4 => ProposalState::Succeeded,
                            5 => ProposalState::Queued,
                            6 => ProposalState::Expired,
                            7 => ProposalState::Executed,
                            _ => ProposalState::Unknown,
                        },
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to fetch proposal state from contract, defaulting to Unknown");
                            ProposalState::Unknown
                        }
                    };

                    let proposal_snapshot_block_result = arbitrum_treasury_governor
                        .proposalSnapshot(proposal_id)
                        .call()
                        .await;
                    let quorum_result = match proposal_snapshot_block_result {
                        Ok(snapshot_block) => {
                            arbitrum_treasury_governor
                                .quorum(snapshot_block)
                                .call()
                                .await
                        }
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to fetch proposal snapshot block, defaulting quorum to 0");
                            Err(e)
                        }
                    };

                    let quorum = match quorum_result {
                        Ok(r) => r.to::<u128>() as f64 / (10.0f64.powi(18)),
                        Err(_) => U256::from(0).as_u128() as f64 / (10.0f64.powi(18)),
                    };

                    let total_delegated_vp = match calculate_total_delegated_vp(created_at).await {
                        Ok(vp) => vp,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to calculate total delegated voting power");
                            0.0 // Default to 0 if calculation fails
                        }
                    };

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: Set(title),
                        body: Set(result.event_data.description.clone()),
                        url: Set(proposal_url),
                        discussion_url: NotSet,
                        choices: Set(json!(choices)),
                        quorum: Set(quorum),
                        proposal_state: Set(proposal_state),
                        marked_spam: NotSet,
                        created_at: Set(created_at),
                        start_at: Set(start_at),
                        end_at: Set(end_at),
                        block_created_at: Set(Some(block_number as i32)),
                        block_start_at: Set(Some(result.event_data.startBlock.to::<u64>() as i32)),
                        block_end_at: Set(Some(result.event_data.endBlock.to::<u64>() as i32)),
                        metadata: Set(json!({"vote_type":"basic", "quorum_choices":[0,2], "total_delegated_vp":total_delegated_vp, "targets":result.event_data.targets, "values":result.event_data.values, "calldatas":result.event_data.calldatas, "signatures":result.event_data.signatures}).into()),
                        txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: Set(Some(result.event_data.proposer.to_string())),
                    };

                    store_proposal(proposal).await;
                    debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, "ArbitrumTreasuryGovernor Proposal stored");
                }

                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::ProposalCreated events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(
    name = "arbitrum_treasury_governor_proposal_executed_handler",
    skip(manifest_path, registry)
)]
async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor ProposalExecuted events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::ProposalExecuted events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
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

                    store_proposal(proposal).await;
                    debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, "ArbitrumTreasuryGovernor Proposal state updated to Executed");
                }

                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::ProposalExecuted events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(
    name = "arbitrum_treasury_governor_proposal_extended_handler",
    skip(manifest_path, registry)
)]
async fn proposal_extended_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalExtended(
        ProposalExtendedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor ProposalExtended events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExtended",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::ProposalExtended events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
                    let extended_deadline = result.event_data.extendedDeadline;

                    let end_at = match estimate_timestamp("ethereum", extended_deadline).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, extended_deadline = %extended_deadline, "Failed to estimate end_at timestamp for ProposalExtended event");
                            continue; // Skip proposal update if timestamp estimation fails
                        }
                    };

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        quorum: NotSet,
                        proposal_state: NotSet,
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: Set(end_at),
                        block_created_at: NotSet,
                        block_start_at: NotSet,
                        block_end_at: NotSet,
                        metadata: NotSet,
                        txid: NotSet,
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: NotSet,
                    };

                    store_proposal(proposal).await;
                    debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, end_at = ?end_at, "ArbitrumTreasuryGovernor Proposal end_at updated for ProposalExtended event");
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExtended",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::ProposalExtended events processed and indexed"
                );
                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(
    name = "arbitrum_treasury_governor_vote_cast_handler",
    skip(manifest_path, registry)
)]
async fn vote_cast_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor VoteCast events to process in this batch.");
                    return Ok(());
                }

                let results_len = results.len();
                info!(
                    event_name = "ArbitrumTreasuryGovernor::VoteCast",
                    event_count = results_len,
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::VoteCast events"
                );

                let governor_id_for_votes = get_governor_id().unwrap();

                let votes: Vec<vote::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        let block_number = result.tx_information.block_number.to::<u64>();
                        let proposal_id = result.event_data.proposalId.to_string();

                        let created_at = match estimate_timestamp("arbitrum", block_number).await {
                            Ok(ts) => ts,
                            Err(e) => {
                                error!(proposal_id = %proposal_id, block_number = block_number, error = %e, "Failed to estimate created_at timestamp for VoteCast event");
                                return None; // Skip vote if timestamp estimation fails
                            }
                        };

                        Some(vote::ActiveModel {
                            id: NotSet,
                            voter_address: Set(result.event_data.voter.to_string()),
                            choice: Set(match result.event_data.support {
                                0 => 1.into(),
                                1 => 0.into(),
                                2 => 2.into(),
                                _ => 2.into(),
                            }),
                            voting_power: Set((result.event_data.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
                            reason: Set(Some(result.event_data.reason.clone())),
                            created_at: Set(created_at),
                            block_created_at: Set(Some(block_number as i32)),
                            txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                            proposal_external_id: Set(proposal_id),
                            proposal_id: NotSet,
                            governor_id: Set(governor_id_for_votes),
                            dao_id: Set(get_dao_id().unwrap()),
                        })
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .filter_map(|vote_opt| async { vote_opt }) // Filter out None values
                    .collect::<Vec<_>>()
                    .await;

                store_votes(votes, governor_id_for_votes).await;

                info!(
                    event_name = "ArbitrumTreasuryGovernor::VoteCast",
                    event_count = results_len,
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::VoteCast events processed and indexed"
                );
                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(
    name = "arbitrum_treasury_governor_handlers",
    skip(manifest_path, registry)
)]
pub async fn arbitrum_treasury_governor_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    proposal_created_handler(manifest_path, registry).await;
    proposal_executed_handler(manifest_path, registry).await;
    proposal_extended_handler(manifest_path, registry).await;
    vote_cast_handler(manifest_path, registry).await;
    info!("Arbitrum Treasury Governor handlers registered.");
}

fn extract_title(description: &str) -> String {
    // ... (same as in arbitrum_core_governor.rs)
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

#[instrument(name = "arbitrum_treasury_governor_calculate_total_delegated_vp", skip(timestamp), fields(timestamp = ?timestamp))]
async fn calculate_total_delegated_vp(timestamp: NaiveDateTime) -> Result<f64> {
    // ... (same as in arbitrum_core_governor.rs)
    use sea_orm::{DbBackend, Statement};

    let db = DB.get().unwrap();

    // Construct the raw SQL query
    let sql = r#"
        WITH latest_voting_power AS (
            SELECT
                voter,
                voting_power,
                ROW_NUMBER() OVER (
                    PARTITION BY voter
                    ORDER BY timestamp DESC, block DESC
                ) AS rn
            FROM voting_power
            WHERE
                voter != '0x00000000000000000000000000000000000A4B86'
                AND timestamp <= $1
        )
        SELECT COALESCE(SUM(voting_power), 0.0) as total_voting_power
        FROM latest_voting_power
        WHERE rn = 1
    "#;

    // Execute the raw SQL query
    let result = db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            sql,
            vec![timestamp.into()],
        ))
        .await
        .context("Failed to execute SQL query")?;

    // Extract the total voting power from the result
    let total_vp: f64 = result
        .map(|qr| qr.try_get::<f64>("", "total_voting_power"))
        .transpose()
        .context("Failed to get total_voting_power from query result")?
        .unwrap_or(0.0);

    debug!(total_voting_power = total_vp, timestamp = ?timestamp, "Total delegated voting power calculated");
    Ok(total_vp)
}
