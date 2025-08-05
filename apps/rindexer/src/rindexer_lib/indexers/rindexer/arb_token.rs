#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arb_token::{
    ARBTokenEventType, DelegateChangedEvent, DelegateVotesChangedEvent, no_extensions,
};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_SLUG_ID_MAP, store_delegations, store_voting_powers},
    },
    rindexer_lib::typings::rindexer::events::arb_token::arb_token_contract,
};
use alloy::hex::ToHexExt;
use futures::stream::{self, StreamExt};
use proposalsapp_db::models::{delegation, voting_power_timeseries};
use rindexer::{
    EthereumSqlTypeWrapper, PgType, RindexerColorize,
    event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus,
    rindexer_error,
};
use sea_orm::{
    ActiveValue::{NotSet, Set},
    prelude::Uuid,
};
use std::collections::HashMap;
use std::{path::PathBuf, sync::Arc};
use tracing::{debug, error, info, instrument};

const CONCURRENCY_LIMIT: usize = 100;

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
    name = "arb_token_delegate_changed_handler",
    skip(manifest_path, registry)
)]
async fn delegate_changed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::DelegateChanged(
        DelegateChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No DelegateChanged events to process in this batch.");
                    return Ok(());
                }

                let results_len = results.len();
                debug!(
                    event_count = results_len,
                    event_name = "ARBToken::DelegateChanged",
                    "Processing events"
                );

                let dao_id = get_dao_id()
                    .ok_or_else(|| rindexer_error!("Failed to get DAO ID for 'arbitrum'"))
                    .unwrap();

                // Process results in parallel using futures streams
                let delegations: Vec<delegation::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        let block_number = result.tx_information.block_number;
                        let delegator_addr = result.event_data.delegator;
                        let delegate_addr = result.event_data.toDelegate;
                        let tx_hash = result.tx_information.transaction_hash;

                        let created_at = match estimate_timestamp("arbitrum", block_number).await {
                            Ok(ts) => ts,
                            Err(e) => {
                                error!(
                                    block_number = block_number,
                                    error = %e,
                                    "Failed to estimate timestamp for DelegateChanged event"
                                );
                                // Returning `Err` here will stop processing the batch.
                                // Depending on your error handling strategy, you might want to handle this differently,
                                // e.g., skip this event and continue with others, or retry.
                                return None; // Skip this delegation if timestamp estimation fails
                            }
                        };

                        debug!(
                            event_name = "ARBToken::DelegateChanged",
                            block_number = block_number,
                            "Processed single event within batch"
                        );

                        Some(delegation::ActiveModel {
                            id: NotSet,
                            delegator: Set(delegator_addr.to_string()),
                            delegate: Set(delegate_addr.to_string()),
                            dao_id: Set(dao_id),
                            block: Set(block_number as i32),
                            timestamp: Set(created_at),
                            txid: Set(Some(result.tx_information.transaction_hash.to_string())),
                        })
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .filter_map(|delegation_opt| async { delegation_opt }) // Filter out None values
                    .collect::<Vec<_>>()
                    .await;

                if !delegations.is_empty() {
                    // Deduplicate delegations by keeping only the last one for each (delegator, dao_id, block) combination
                    let mut deduped_delegations: HashMap<
                        (String, Uuid, i32),
                        delegation::ActiveModel,
                    > = HashMap::new();

                    for delegation in delegations {
                        let delegator = delegation.delegator.clone().unwrap();
                        let dao_id = delegation.dao_id.clone().unwrap();
                        let block = delegation.block.clone().unwrap();

                        let key = (delegator, dao_id, block);
                        deduped_delegations.insert(key, delegation);
                    }

                    let final_delegations: Vec<delegation::ActiveModel> =
                        deduped_delegations.into_values().collect();

                    if let Err(e) = store_delegations(final_delegations).await {
                        error!(error = %e, "Failed to store delegations");
                    }
                }

                info!(
                    event_name = "ARBToken::DelegateChanged",
                    indexed_event_count = results_len,
                    status = "INDEXED",
                    "ARBToken::DelegateChanged - INDEXED"
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
    name = "arb_token_delegate_votes_changed_handler",
    skip(manifest_path, registry)
)]
async fn delegate_votes_changed_handler(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    ARBTokenEventType::DelegateVotesChanged(
        DelegateVotesChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No DelegateVotesChanged events to process in this batch.");
                    return Ok(());
                }
                let results_len = results.len();
                debug!(
                    event_count = results_len,
                    event_name = "ARBToken::DelegateVotesChanged",
                    "Processing events"
                );

                let dao_id = get_dao_id()
                    .ok_or_else(|| rindexer_error!("Failed to get DAO ID for 'arbitrum'"))
                    .unwrap();

                // Process results in parallel using futures streams
                let vps: Vec<voting_power_timeseries::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        let block_number = result.tx_information.block_number;
                        let delegate_addr = result.event_data.delegate;
                        let new_balance = result.event_data.newBalance;
                        let tx_hash = result.tx_information.transaction_hash;

                        let created_at = match estimate_timestamp("arbitrum", block_number).await {
                            Ok(ts) => ts,
                            Err(e) => {
                                error!(
                                    block_number = block_number,
                                    error = %e,
                                    "Failed to estimate timestamp for DelegateVotesChanged event"
                                );
                                return None; // Skip this voting power update if timestamp estimation fails
                            }
                        };

                        debug!(
                            event_name = "ARBToken::DelegateVotesChanged",
                            block_number = block_number,
                            "Processed single event within batch"
                        );

                        Some(voting_power_timeseries::ActiveModel {
                            id: NotSet,
                            voter: Set(delegate_addr.to_string()),
                            voting_power: Set(new_balance.to::<u128>() as f64 / (10.0f64.powi(18))),
                            dao_id: Set(dao_id),
                            block: Set(block_number as i32),
                            timestamp: Set(created_at),
                            txid: Set(Some(result.tx_information.transaction_hash.to_string())),
                        })
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .filter_map(|vp_opt| async { vp_opt }) // Filter out None values
                    .collect::<Vec<_>>()
                    .await;

                if !vps.is_empty() {
                    // Deduplicate voting powers by keeping only the last one for each (voter, dao_id, block) combination
                    let mut deduped_vps: HashMap<
                        (String, Uuid, i32),
                        voting_power_timeseries::ActiveModel,
                    > = HashMap::new();

                    for vp in vps {
                        let voter = vp.voter.clone().unwrap();
                        let dao_id = vp.dao_id.clone().unwrap();
                        let block = vp.block.clone().unwrap();

                        let key = (voter, dao_id, block);
                        deduped_vps.insert(key, vp);
                    }

                    let final_vps: Vec<voting_power_timeseries::ActiveModel> =
                        deduped_vps.into_values().collect();

                    if let Err(e) = store_voting_powers(final_vps).await {
                        error!(error = %e, "Failed to store voting powers");
                    }
                }

                info!(
                    event_name = "ARBToken::DelegateVotesChanged",
                    indexed_event_count = results_len,
                    status = "INDEXED",
                    "ARBToken::DelegateVotesChanged - INDEXED"
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

#[instrument(name = "arb_token_handlers", skip(manifest_path, registry))]
pub async fn arb_token_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    delegate_changed_handler(manifest_path, registry).await;
    delegate_votes_changed_handler(manifest_path, registry).await;
    info!("ARB Token handlers registered.");
}
