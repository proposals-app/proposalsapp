use self::rindexer_lib::indexers::all_handlers::register_all_handlers;
use anyhow::{Context, Result};
use dotenv::dotenv;
use extensions::{db_extension::initialize_db, snapshot_api::initialize_snapshot_api};
use rindexer::{
    GraphqlOverrideSettings, IndexingDetails, StartDetails,
    event::callback_registry::TraceCallbackRegistry, start_rindexer,
};
use std::env;
use tasks::{
    onchain_proposals_updates::run_periodic_proposal_state_update,
    snapshot_proposals::run_periodic_snapshot_proposals_update,
    snapshot_votes::run_periodic_snapshot_votes_update,
};
use tracing::{error, info, instrument};
use utils::tracing::setup_otel;

mod extensions;
mod rindexer_lib;
mod tasks;

#[instrument]
#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let _otel = setup_otel().await?;
    info!("Application starting up");

    initialize_db()
        .await
        .context("Failed to initialize database")?;

    initialize_snapshot_api()
        .await
        .context("Failed to initialize snapshot API")?;

    // Spawn periodic tasks and store their handles
    let snapshot_proposals_handle = tokio::spawn(async {
        if let Err(e) = run_periodic_snapshot_proposals_update().await {
            error!("Error in periodic snapshot proposals update task: {:?}", e);
        }
    });

    let snapshot_votes_handle = tokio::spawn(async {
        if let Err(e) = run_periodic_snapshot_votes_update().await {
            error!("Error in periodic snapshot votes update task: {:?}", e);
        }
    });

    let proposal_state_handle = tokio::spawn(async {
        if let Err(e) = run_periodic_proposal_state_update().await {
            error!("Error in periodic proposal state update task: {:?}", e);
        }
    });

    // Start rindexer in a separate task
    info!("Starting rindexer");
    let rindexer_handle = tokio::spawn(async move {
        let path = env::current_dir()
            .context("Failed to get current directory")
            .unwrap();
        let manifest_path = path.join("rindexer.yaml");

        let indexer_settings = StartDetails {
            manifest_path: &manifest_path,
            indexing_details: Some(IndexingDetails {
                registry: register_all_handlers(&manifest_path).await,
                trace_registry: TraceCallbackRegistry { events: vec![] },
            }),
            graphql_details: GraphqlOverrideSettings {
                enabled: false,
                override_port: None,
            },
        };

        if let Err(e) = start_rindexer(indexer_settings).await {
            error!("Rindexer failed: {:?}", e);
        }
    });

    info!("All tasks started, application running indefinitely");

    // Wait for any task to complete or for shutdown signal
    tokio::select! {
        result = snapshot_proposals_handle => {
            error!("Snapshot proposals task completed unexpectedly: {:?}", result);
        }
        result = snapshot_votes_handle => {
            error!("Snapshot votes task completed unexpectedly: {:?}", result);
        }
        result = proposal_state_handle => {
            error!("Proposal state task completed unexpectedly: {:?}", result);
        }
        result = rindexer_handle => {
            error!("Rindexer task completed unexpectedly: {:?}", result);
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down gracefully");
        }
    }

    info!("Application shutting down");
    Ok(())
}
