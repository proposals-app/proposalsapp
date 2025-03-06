#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arb_token::{ARBTokenEventType, DelegateChangedEvent, DelegateVotesChangedEvent, no_extensions};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_ID_SLUG_MAP, store_delegation, store_voting_power},
    },
    rindexer_lib::typings::rindexer::events::arb_token::arb_token_contract,
};
use ethers::utils::{hex::ToHex, to_checksum};
use proposalsapp_db_indexer::models::{delegation, voting_power};
use rindexer::{EthereumSqlTypeWrapper, PgType, RindexerColorize, event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus, rindexer_error};
use sea_orm::{
    ActiveValue::{NotSet, Set},
    prelude::Uuid,
};
use std::{path::PathBuf, sync::Arc};
use tracing::{info, instrument};

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

                for result in results.clone() {
                    let arbitrum_core_governor = arb_token_contract("arbitrum");

                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let delegation = delegation::ActiveModel {
                        id: NotSet,
                        delegator: Set(to_checksum(&result.event_data.delegator, None)),
                        delegate: Set(to_checksum(&result.event_data.to_delegate, None)),
                        dao_id: Set(get_dao_id().unwrap()),
                        block: Set(result.tx_information.block_number.as_u64() as i32),
                        timestamp: Set(created_at),
                        txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                    };

                    store_delegation(delegation).await;
                }

                info!(
                    event = "ARBToken::DelegateChanged",
                    status = %IndexingEventProgressStatus::Indexed.log(),
                    results = results.len(),
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

                for result in results.clone() {
                    let arbitrum_core_governor = arb_token_contract("arbitrum");

                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let vp = voting_power::ActiveModel {
                        id: NotSet,
                        voter: Set(to_checksum(&result.event_data.delegate, None)),
                        voting_power: Set(result.event_data.new_balance.as_u128() as f64 / (10.0f64.powi(18))),
                        dao_id: Set(get_dao_id().unwrap()),
                        block: Set(result.tx_information.block_number.as_u64() as i32),
                        timestamp: Set(created_at),
                        txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                    };

                    store_voting_power(vp).await;
                }

                info!(
                    event = "ARBToken::DelegateVotesChanged",
                    status = %IndexingEventProgressStatus::Indexed.log(),
                    results = results.len(),
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
