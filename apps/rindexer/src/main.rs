use self::rindexer_lib::indexers::all_handlers::register_all_handlers;
use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use extensions::{db_extension::initialize_db, snapshot_api::initialize_snapshot_api};
use reqwest::Client;
use rindexer::{
    GraphqlOverrideSettings, IndexingDetails, StartDetails,
    event::callback_registry::TraceCallbackRegistry, start_rindexer,
};
use std::{env, time::Duration};
use tasks::{
    onchain_proposals_updates::run_periodic_proposal_state_update,
    snapshot_proposals::run_periodic_snapshot_proposals_update,
    snapshot_votes::run_periodic_snapshot_votes_update,
};
use tracing::{error, info, instrument, warn};
use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

mod extensions;
mod rindexer_lib;
mod tasks;

#[instrument]
#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    
    // Initialize JSON logging for stdout
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"))
        .add_directive("hyper_util=off".parse().unwrap())
        .add_directive("alloy_rpc_client=off".parse().unwrap())
        .add_directive("reqwest=off".parse().unwrap())
        .add_directive("alloy_transport_http=off".parse().unwrap());
    
    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .json()
                .with_target(true)
                .with_file(true)
                .with_line_number(true)
                .with_thread_ids(true)
        )
        .init();
    
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

    let uptime_handle = tokio::spawn(async move {
        match std::env::var("BETTERSTACK_KEY") {
            Ok(betterstack_key) => {
                let client = Client::new();
                info!("BetterStack uptime monitoring enabled");
                loop {
                    match client.get(&betterstack_key).send().await {
                        Ok(_) => info!("Uptime ping sent successfully"),
                        Err(e) => warn!(error = %e, "Failed to send uptime ping"),
                    }
                    tokio::time::sleep(Duration::from_secs(10)).await;
                }
            }
            Err(_) => {
                info!("BETTERSTACK_KEY not set, uptime monitoring disabled");
                // Keep the task alive but do nothing
                loop {
                    tokio::time::sleep(Duration::from_secs(3600)).await;
                }
            }
        }
    });

    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let health_server_handle = tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
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
        result = health_server_handle => {
            error!("Health server task completed unexpectedly: {:?}", result);
        }
        result = uptime_handle => {
            error!("Uptime task completed unexpectedly: {:?}", result);
        }
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
