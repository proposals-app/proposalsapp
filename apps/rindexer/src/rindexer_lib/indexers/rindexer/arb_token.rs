#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arb_token::{
    no_extensions, ARBTokenEventType, ApprovalEvent, DelegateChangedEvent, DelegateVotesChangedEvent, InitializedEvent,
    OwnershipTransferredEvent, TransferEvent,
};
use rindexer::{
    event::callback_registry::EventCallbackRegistry, rindexer_error, rindexer_info, EthereumSqlTypeWrapper, PgType, RindexerColorize,
};
use std::{path::PathBuf, sync::Arc};

async fn approval_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::Approval(
        ApprovalEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!("ARBToken::Approval - {} - {} events", "INDEXED".green(), results.len(),);

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn delegate_changed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::DelegateChanged(
        DelegateChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!("ARBToken::DelegateChanged - {} - {} events", "INDEXED".green(), results.len(),);

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn delegate_votes_changed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::DelegateVotesChanged(
        DelegateVotesChangedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!("ARBToken::DelegateVotesChanged - {} - {} events", "INDEXED".green(), results.len(),);

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn initialized_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::Initialized(
        InitializedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!("ARBToken::Initialized - {} - {} events", "INDEXED".green(), results.len(),);

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn ownership_transferred_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::OwnershipTransferred(
        OwnershipTransferredEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!("ARBToken::OwnershipTransferred - {} - {} events", "INDEXED".green(), results.len(),);

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn transfer_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ARBTokenEventType::Transfer(
        TransferEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!("ARBToken::Transfer - {} - {} events", "INDEXED".green(), results.len(),);

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}
pub async fn arb_token_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    // approval_handler(manifest_path, registry).await;

    delegate_changed_handler(manifest_path, registry).await;

    // delegate_votes_changed_handler(manifest_path, registry).await;

    // initialized_handler(manifest_path, registry).await;

    // ownership_transferred_handler(manifest_path, registry).await;

    // transfer_handler(manifest_path, registry).await;
}
