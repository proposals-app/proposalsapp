#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_sc_nominations::{
    ArbitrumSCNominationsEventType, ProposalCreatedEvent, ProposalExecutedEvent, no_extensions,
};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, store_proposal},
    },
    rindexer_lib::typings::rindexer::events::arbitrum_sc_nominations::arbitrum_sc_nominations_contract,
};
use alloy::{hex::ToHexExt, primitives::U256};
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState};
use regex::Regex;
use rindexer::{
    EthereumSqlTypeWrapper, PgType, RindexerColorize,
    event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus,
    rindexer_error, rindexer_info,
};
use sea_orm::{
    ActiveValue::{NotSet, Set},
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
        .get("ARBITRUM_SC_NOMINATIONS")
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

#[instrument(
    name = "arbitrum_sc_nominations_proposal_created_handler",
    skip(manifest_path, registry)
)]
async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumSCNominationsEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumSCNominations ProposalCreated events to process in this batch.");
                    return Ok(());
                }

                info!(
                    event_name = "ArbitrumSCNominations::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumSCNominations::ProposalCreated events"
                );

                let url_regex = Regex::new(r"Security Council Election #(\d+)").unwrap();

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
                    let block_number = result.tx_information.block_number.to::<u64>();

                    let arbitrum_sc_nominations_governor = arbitrum_sc_nominations_contract("arbitrum").await;

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

                    let proposal_url = url_regex
                        .captures(&result.event_data.description)
                        .and_then(|caps| caps.get(1).map(|m| m.as_str()))
                        .map_or_else(String::new, |election_number| {
                            format!(
                                "https://www.tally.xyz/gov/arbitrum/council/security-council/election/{}/round-1",
                                election_number
                            )
                        });

                    let proposal_state_result = arbitrum_sc_nominations_governor
                        .state(proposal_id)
                        .call()
                        .await;
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

                    let proposal_snapshot_block_result = arbitrum_sc_nominations_governor
                        .proposalSnapshot(proposal_id)
                        .call()
                        .await;
                    let quorum_result = match proposal_snapshot_block_result {
                        Ok(snapshot_block) => {
                            arbitrum_sc_nominations_governor
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
                        Err(_) => U256::from(0).to::<u128>() as f64 / (10.0f64.powi(18)),
                    };

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: Set(result.event_data.description.clone()),
                        body: Set(result.event_data.description.clone()),
                        url: Set(proposal_url),
                        discussion_url: NotSet,
                        choices: Set(json!([])),
                        quorum: Set(quorum),
                        proposal_state: Set(proposal_state),
                        marked_spam: NotSet,
                        created_at: Set(created_at),
                        start_at: Set(start_at),
                        end_at: Set(end_at),
                        block_created_at: Set(Some(block_number as i32)),
                        block_start_at: Set(Some(result.event_data.startBlock.to::<u64>() as i32)),
                        block_end_at: Set(Some(result.event_data.endBlock.to::<u64>() as i32)),
                        metadata: Set(json!({"vote_type":"sc_nominations"}).into()),
                        txid: Set(Some(result.tx_information.transaction_hash.to_string())),
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: Set(Some(result.event_data.proposer.to_string())),
                    };

                    store_proposal(proposal).await;
                    debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, "ArbitrumSCNominations Proposal stored");
                }

                info!(
                    event_name = "ArbitrumSCNominations::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumSCNominations::ProposalCreated events processed and indexed"
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
    name = "arbitrum_sc_nominations_proposal_executed_handler",
    skip(manifest_path, registry)
)]
async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumSCNominationsEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!(
                        "No ArbitrumSCNominations ProposalExecuted events to process in this batch."
                    );
                    return Ok(());
                }

                info!(
                    event_name = "ArbitrumSCNominations::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumSCNominations::ProposalExecuted - INDEXED"
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
    name = "arbitrum_sc_nominations_handlers",
    skip(manifest_path, registry)
)]
pub async fn arbitrum_sc_nominations_handlers(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    proposal_created_handler(manifest_path, registry).await;
    proposal_executed_handler(manifest_path, registry).await;
    info!("Arbitrum SC Nominations handlers registered.");
}
