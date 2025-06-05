use super::rindexer::{arb_token::arb_token_handlers, arbitrum_core_governor::arbitrum_core_governor_handlers, arbitrum_sc_nominations::arbitrum_sc_nominations_handlers, arbitrum_treasury_governor::arbitrum_treasury_governor_handlers, uni_token::uni_token_handlers};
use rindexer::event::callback_registry::EventCallbackRegistry;
use std::path::PathBuf;

pub async fn register_all_handlers(manifest_path: &PathBuf) -> EventCallbackRegistry {
    let mut registry = EventCallbackRegistry::new();
    arb_token_handlers(manifest_path, &mut registry).await;
    arbitrum_core_governor_handlers(manifest_path, &mut registry).await;
    arbitrum_treasury_governor_handlers(manifest_path, &mut registry).await;
    arbitrum_sc_nominations_handlers(manifest_path, &mut registry).await;
    uni_token_handlers(manifest_path, &mut registry).await;
    registry
}
