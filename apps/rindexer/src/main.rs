use self::rindexer_lib::indexers::all_handlers::register_all_handlers;
use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use extensions::{db_extension::initialize_db, snapshot_api::initialize_snapshot_api};
use reqwest::Client;
use rindexer::{GraphqlOverrideSettings, IndexingDetails, StartDetails, event::callback_registry::TraceCallbackRegistry, start_rindexer};
use std::{env, time::Duration};
use tasks::{block_times::run_periodic_block_times_update, ended_onchian_proposals::run_periodic_proposal_state_update, snapshot_proposals::run_periodic_snapshot_proposals_update, snapshot_votes::run_periodic_snapshot_votes_update};
use tracing::{error, info, instrument, warn};
use utils::tracing::setup_otel;

mod extensions;
mod rindexer_lib;
mod tasks;

#[instrument]
#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let _otel = setup_otel()
        .await
        .context("Failed to setup OpenTelemetry")?;

    initialize_db()
        .await
        .context("Failed to initialize database")?;

    initialize_snapshot_api()
        .await
        .context("Failed to initialize snapshot API")?;

    tokio::spawn(async {
        if let Err(e) = run_periodic_snapshot_proposals_update().await {
            error!("Error in periodic snapshot proposals update task: {:?}", e);
        }
    });

    tokio::spawn(async {
        if let Err(e) = run_periodic_snapshot_votes_update().await {
            error!("Error in periodic snapshot votes update task: {:?}", e);
        }
    });

    tokio::spawn(async {
        if let Err(e) = run_periodic_proposal_state_update().await {
            error!("Error in periodic proposal state update task: {:?}", e);
        }
    });

    tokio::spawn(async {
        if let Err(e) = run_periodic_block_times_update().await {
            error!("Error in periodic block times update task: {:?}", e);
        }
    });

    tokio::spawn(async move {
        let client = Client::new();
        let betterstack_key = std::env::var("BETTERSTACK_KEY").expect("BETTERSTACK_KEY missing");

        loop {
            match client.get(&betterstack_key).send().await {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!(error = %e, "Failed to send uptime ping"),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
        }
    });

    let path = env::current_dir().context("Failed to get current directory")?;
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

    println!("Indexer settings: {:?}", indexer_settings);

    start_rindexer(indexer_settings)
        .await
        .context("Failed to start rindexer")?;

    std::future::pending::<()>().await;

    Ok(())
}
