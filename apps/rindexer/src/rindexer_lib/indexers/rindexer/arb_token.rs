#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arb_token::{no_extensions, ARBTokenEventType, DelegateChangedEvent, DelegateVotesChangedEvent};
use rindexer::{event::callback_registry::EventCallbackRegistry, rindexer_error, rindexer_info, EthereumSqlTypeWrapper, PgType, RindexerColorize};
use std::{path::PathBuf, sync::Arc};
use tracing::instrument;

#[instrument(skip(manifest_path, registry))]
async fn delegate_changed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::DelegateChanged(
        DelegateChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ARBToken::DelegateChanged - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
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

                rindexer_info!(
                    "ARBToken::DelegateVotesChanged - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
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
