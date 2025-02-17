use super::rindexer::arb_token::arb_token_handlers;
use super::rindexer::arbitrum_core_governor::arbitrum_core_governor_handlers;
use super::rindexer::arbitrum_treasury_governor::arbitrum_treasury_governor_handlers;
use crate::extensions::db_extension::initialize_db;
use rindexer::event::callback_registry::EventCallbackRegistry;
use std::path::PathBuf;

pub async fn register_all_handlers(manifest_path: &PathBuf) -> EventCallbackRegistry {
    let mut registry = EventCallbackRegistry::new();

    let _ = initialize_db().await;

    arbitrum_core_governor_handlers(manifest_path, &mut registry).await;
    arbitrum_treasury_governor_handlers(manifest_path, &mut registry).await;
    arb_token_handlers(manifest_path, &mut registry).await;
    registry
}
