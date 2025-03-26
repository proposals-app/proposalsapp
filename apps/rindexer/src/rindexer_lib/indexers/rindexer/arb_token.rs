#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arb_token::{ARBTokenEventType, DelegateChangedEvent, DelegateVotesChangedEvent, no_extensions};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_ID_SLUG_MAP, store_delegations, store_voting_powers},
    },
    rindexer_lib::typings::rindexer::events::arb_token::arb_token_contract,
};
use ethers::utils::{hex::ToHex, to_checksum};
use futures::stream::{self, StreamExt};
use proposalsapp_db_indexer::models::{delegation, voting_power};
use rindexer::{EthereumSqlTypeWrapper, PgType, RindexerColorize, event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus, rindexer_error};
use sea_orm::{
    ActiveValue::{NotSet, Set},
    prelude::Uuid,
};
use std::{path::PathBuf, sync::Arc};
use tracing::{info, instrument};

const CONCURRENCY_LIMIT: usize = 100;

fn get_dao_id() -> Option<Uuid> {
    DAO_ID_SLUG_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .copied()
}

#[instrument(skip(manifest_path, registry))]
async fn delegate_changed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::DelegateChanged(
        DelegateChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                let results_len = results.len();

                let dao_id = get_dao_id()
                    .ok_or_else(|| rindexer_error!("Failed to get DAO ID for 'arbitrum'"))
                    .unwrap();

                // Process results in parallel using futures streams
                let delegations: Vec<delegation::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        let block_number = result.tx_information.block_number.as_u64();
                        let delegator_addr = result.event_data.delegator;
                        let delegate_addr = result.event_data.to_delegate;
                        let tx_hash = result.tx_information.transaction_hash;

                        let created_at = estimate_timestamp("arbitrum", block_number)
                            .await
                            .expect("Failed to estimate created timestamp");

                        delegation::ActiveModel {
                            id: NotSet,
                            delegator: Set(to_checksum(&delegator_addr, None)),
                            delegate: Set(to_checksum(&delegate_addr, None)),
                            dao_id: Set(dao_id),
                            block: Set(block_number as i32),
                            timestamp: Set(created_at),
                            txid: Set(Some(tx_hash.encode_hex())),
                        }
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .collect::<Vec<_>>()
                    .await;

                if !delegations.is_empty() {
                    store_delegations(delegations).await;
                }

                info!(
                    "{} - {} - {}",
                    "ARBToken::DelegateChanged",
                    results_len,
                    "INDEXED".green().to_string(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(skip(manifest_path, registry))]
async fn delegate_votes_changed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::DelegateVotesChanged(
        DelegateVotesChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                let results_len = results.len();

                let dao_id = get_dao_id()
                    .ok_or_else(|| rindexer_error!("Failed to get DAO ID for 'arbitrum'"))
                    .unwrap();

                // Process results in parallel using futures streams
                let vps: Vec<voting_power::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        let block_number = result.tx_information.block_number.as_u64();
                        let delegate_addr = result.event_data.delegate;
                        let new_balance = result.event_data.new_balance;
                        let tx_hash = result.tx_information.transaction_hash;

                        let created_at = estimate_timestamp("arbitrum", block_number)
                            .await
                            .expect("Failed to estimate created timestamp");

                        voting_power::ActiveModel {
                            id: NotSet,
                            voter: Set(to_checksum(&delegate_addr, None)),
                            voting_power: Set(new_balance.as_u128() as f64 / (10.0f64.powi(18))),
                            dao_id: Set(dao_id),
                            block: Set(block_number as i32),
                            timestamp: Set(created_at),
                            txid: Set(Some(tx_hash.encode_hex())),
                        }
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .collect::<Vec<_>>()
                    .await;

                if !vps.is_empty() {
                    store_voting_powers(vps).await;
                }

                info!(
                    "{} - {} - {}",
                    "ARBToken::DelegateVotesChanged",
                    results_len,
                    "INDEXED".green().to_string(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(skip(manifest_path, registry))]
pub async fn arb_token_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    delegate_changed_handler(manifest_path, registry).await;
    delegate_votes_changed_handler(manifest_path, registry).await;
}
