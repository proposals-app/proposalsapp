use self::rindexer_lib::indexers::all_handlers::register_all_handlers;
use anyhow::{Context, Result, anyhow};
use dotenv::dotenv;
use extensions::db_extension::initialize_db;
use proposalsapp_rindexer::supervision::run_task_forever;
use reqwest::Client;
use rindexer::{
    GraphqlOverrideSettings, IndexingDetails, StartDetails,
    event::callback_registry::TraceCallbackRegistry, start_rindexer,
};
use std::{env, time::Duration};
use tasks::{
    indexing_health::{
        HeartbeatGate, IndexingHealth, IndexingHealthConfig, describe_streams,
        progress_streams_from_manifest,
    },
    onchain_proposals_updates::run_periodic_proposal_state_update,
    snapshot_indexer::run_periodic_snapshot_indexing,
};
use tracing::{debug, error, info, instrument, warn};
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

mod extensions;
mod rindexer_lib;
mod tasks;

#[instrument]
#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    // rindexer pulls both `ring` and `aws-lc-rs` through transitive deps, so rustls
    // cannot auto-select a provider on startup.
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

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
                .with_thread_ids(true),
        )
        .init();

    info!("Application starting up");

    initialize_db()
        .await
        .context("Failed to initialize database")?;

    let manifest_path = env::current_dir()
        .context("Failed to get current directory")?
        .join("rindexer.yaml");

    // Progress-aware health: /health and the uptime heartbeat only report healthy
    // while rindexer's checkpoints keep advancing.
    let progress_streams = progress_streams_from_manifest(&manifest_path).unwrap_or_else(|e| {
        error!(error = ?e, "Failed to load indexing streams; health will report stalled");
        Vec::new()
    });
    info!(streams = ?describe_streams(&progress_streams), "Monitoring indexing progress");
    let indexing_health = IndexingHealth::new(progress_streams, IndexingHealthConfig::from_env());

    let progress_monitor_handle = tokio::spawn({
        let indexing_health = indexing_health.clone();
        async move {
            run_task_forever("indexing-progress", Duration::from_secs(5), || {
                let indexing_health = indexing_health.clone();
                async move { indexing_health.run_progress_monitor().await }
            })
            .await;
        }
    });

    let health_server_handle = tokio::spawn({
        let indexing_health = indexing_health.clone();
        async move { indexing_health.serve().await }
    });

    // Spawn periodic tasks and store their handles
    let snapshot_indexing_handle = tokio::spawn(async {
        if let Err(e) = run_periodic_snapshot_indexing().await {
            error!("Error in periodic snapshot indexing task: {:?}", e);
        }
    });

    let proposal_state_handle = tokio::spawn(async {
        run_task_forever("proposal-state", Duration::from_secs(5), || async {
            run_periodic_proposal_state_update().await
        })
        .await;
    });

    let uptime_handle = tokio::spawn(async move {
        match std::env::var("BETTERSTACK_KEY") {
            Ok(betterstack_key) => {
                let client = Client::new();
                let mut gate = HeartbeatGate::default();
                info!("BetterStack uptime monitoring enabled");
                loop {
                    // Only ping while indexing is progressing, so a stall alerts.
                    if gate.should_ping(&indexing_health.report()) {
                        match client.get(&betterstack_key).send().await {
                            Ok(_) => debug!("Uptime ping sent successfully"),
                            // The heartbeat URL embeds the BetterStack token; keep it out of logs.
                            Err(e) => warn!(error = %e.without_url(), "Failed to send uptime ping"),
                        }
                    } else {
                        debug!("Indexing stalled; uptime ping skipped");
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

    // Start rindexer in a separate task
    info!("Starting rindexer");
    let rindexer_handle = tokio::spawn(async move {
        run_task_forever("rindexer", Duration::from_secs(5), move || {
            let manifest_path = manifest_path.clone();

            async move {
                let indexer_settings = StartDetails {
                    manifest_path: &manifest_path,
                    indexing_details: Some(IndexingDetails {
                        registry: register_all_handlers(&manifest_path).await,
                        trace_registry: TraceCallbackRegistry::new(),
                        event_stream: None,
                    }),
                    graphql_details: GraphqlOverrideSettings {
                        enabled: false,
                        override_port: None,
                    },
                    cron_scheduler_handle: None,
                    watch: false,
                };

                start_rindexer(indexer_settings)
                    .await
                    .map_err(|err| anyhow!("Rindexer failed: {:?}", err))
            }
        })
        .await;
    });

    info!("All tasks started, application running indefinitely");

    // Wait for any task to complete or for shutdown signal
    tokio::select! {
        result = uptime_handle => {
            error!("Uptime task completed unexpectedly: {:?}", result);
        }
        result = snapshot_indexing_handle => {
            error!("Snapshot indexing task completed unexpectedly: {:?}", result);
        }
        result = proposal_state_handle => {
            error!("Proposal state task completed unexpectedly: {:?}", result);
        }
        result = rindexer_handle => {
            error!("Rindexer task completed unexpectedly: {:?}", result);
        }
        result = progress_monitor_handle => {
            error!("Indexing progress monitor completed unexpectedly: {:?}", result);
        }
        result = health_server_handle => {
            error!("Health server completed unexpectedly: {:?}", result);
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down gracefully");
        }
    }

    info!("Application shutting down");
    Ok(())
}
