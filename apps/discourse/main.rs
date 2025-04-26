#![warn(unused_extern_crates)]

use crate::{
    db_handler::{db, initialize_db},
    discourse_api::DiscourseApi,
    indexers::{categories::CategoryIndexer, revisions::RevisionIndexer, topics::TopicIndexer, users::UserIndexer},
};
use anyhow::{Context, Result};
use axum::{Router, routing::get};
use dotenv::dotenv;
use proposalsapp_db_indexer::models::dao_discourse;
use reqwest::Client;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, prelude::Uuid};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{signal, sync::watch, task::JoinSet, time::interval_at};
use tracing::{Instrument, debug, error, info, instrument, warn};
use utils::tracing::setup_otel;

mod db_handler;
mod discourse_api;
mod indexers;
mod models;

// --- Configuration Constants ---
const FULL_REFRESH_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
const INITIAL_FULL_REFRESH_TASK_DELAY: Duration = Duration::from_secs(60 * 60);

const RECENT_UPDATE_INTERVAL: Duration = Duration::from_secs(60);
const INITIAL_RECENT_UPDATE_TASK_DELAY: Duration = Duration::from_secs(5);

const HEALTH_CHECK_PORT: u16 = 3000;
const BETTERSTACK_HEARTBEAT_ENV: &str = "BETTERSTACK_KEY";

pub const MAX_PAGES_PER_RUN: u32 = 1000; // Safety break for pagination loops
pub const RECENT_LOOKBACK_HOURS: i64 = 2; // How far back to look for "recent" items

lazy_static::lazy_static! {
    static ref DAO_DISCOURSE_ID_TO_CATEGORY_IDS_PROPOSALS: HashMap<Uuid, Vec<i32>> = {
        let mut m = HashMap::new();
        m.insert(Uuid::parse_str("099352eb-b859-44ff-acbc-76806d304086").unwrap(), vec![7, 8, 9]);
        m
    };
}

#[tokio::main]
#[instrument]
async fn main() -> Result<()> {
    dotenv().ok();
    let _otel_guard = setup_otel()
        .await
        .context("Failed to setup OpenTelemetry")?;

    info!("Discourse Indexer application starting up...");

    initialize_db()
        .await
        .context("Database initialization failed")?;

    info!("Database initialized.");

    // --- Shutdown Signal Handling ---
    let (shutdown_tx, shutdown_rx) = watch::channel(());
    let mut shutdown_rx_clone = shutdown_rx.clone();

    // --- Start Health Check Server ---
    let server_handle = tokio::spawn(
        async move {
            let app = Router::new().route("/", get(|| async { "OK" }));
            let bind_addr = format!("0.0.0.0:{}", HEALTH_CHECK_PORT);
            info!(address = %bind_addr, "Starting health check server");

            let listener = match tokio::net::TcpListener::bind(&bind_addr).await {
                Ok(l) => l,
                Err(e) => {
                    error!(error = ?e, address = %bind_addr, "Failed to bind health check server");
                    return; // Exit task if binding fails
                }
            };

            let server = axum::serve(listener, app).with_graceful_shutdown(async move {
                shutdown_rx_clone.changed().await.ok();
                info!("Health check server received shutdown signal.");
            });

            if let Err(e) = server.await {
                error!(error = ?e, "Health check server error occurred");
            }
            info!("Health check server shut down.");
        }
        .instrument(tracing::info_span!("health_check_server")),
    );

    // --- Initialize API Clients and Indexers ---
    let dao_discourses = dao_discourse::Entity::find()
        .filter(dao_discourse::Column::Enabled.eq(true))
        .find_with_related(proposalsapp_db_indexer::models::dao::Entity)
        .all(db())
        .await
        .context("Failed to fetch enabled DAO Discourse configurations with DAO names")?;

    if dao_discourses.is_empty() {
        warn!("No enabled DAO Discourse configurations found. Indexer will idle.");
        // Wait for shutdown signal if no DAOs are configured
        tokio::select! {
             _ = signal::ctrl_c() => { info!("Received Ctrl+C signal while idle."); },
             res = wait_for_sigterm() => { if res.is_ok() { info!("Received SIGTERM signal while idle."); } }
        }
        shutdown_tx.send(()).ok(); // Notify server to shutdown
        // Wait for server task completion
        if let Err(e) = server_handle.await {
            error!(error = ?e, "Error joining health check server task during idle shutdown");
        }
        // No need for double question mark '??' here
        return Ok(());
    }

    let shared_http_client = Arc::new(Client::new());
    let mut indexer_tasks = JoinSet::new();

    for (dao_config, dao_details_vec) in dao_discourses {
        // Assuming one DAO per dao_discourse record
        let dao_name = dao_details_vec
            .first()
            .map(|d| d.name.clone())
            .unwrap_or_else(|| {
                warn!(dao_discourse_id = %dao_config.id, "Missing DAO details for dao_discourse record. Using ID as name.");
                dao_config.id.to_string()
            });

        info!(%dao_name, dao_id = %dao_config.id, base_url = %dao_config.discourse_base_url, "Initializing indexer tasks for DAO");

        let api_client = Arc::new(DiscourseApi::new(
            dao_config.discourse_base_url.clone(),
            dao_config.with_user_agent,
        ));

        // Create indexer instances
        let category_indexer = CategoryIndexer::new(Arc::clone(&api_client));
        let user_indexer = UserIndexer::new(Arc::clone(&api_client), Arc::clone(&shared_http_client));
        let topic_indexer = TopicIndexer::new(Arc::clone(&api_client), Arc::clone(&shared_http_client));
        let revision_indexer = RevisionIndexer::new(Arc::clone(&api_client));

        // --- Spawn Full Refresh Task ---
        let dao_id_full = dao_config.id;
        let dao_name_full = dao_name.clone();
        let cat_idx_full = category_indexer.clone();
        let user_idx_full = user_indexer.clone();
        let topic_idx_full = topic_indexer.clone();
        let rev_idx_full = revision_indexer.clone();
        let mut shutdown_rx_full = shutdown_rx.clone();

        indexer_tasks.spawn(
            async move {
                let task_name = format!("full_refresh_{}", dao_name_full);
                info!(task = %task_name, "Starting full refresh task loop");
                let start_delay = tokio::time::Instant::now() + INITIAL_FULL_REFRESH_TASK_DELAY;
                let mut interval = interval_at(start_delay, FULL_REFRESH_INTERVAL);
                interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

                loop {
                    tokio::select! {
                        biased; // Prioritize shutdown check
                        _ = shutdown_rx_full.changed() => {
                             info!(task = %task_name, "Received shutdown signal. Exiting full refresh loop.");
                             break;
                        }
                        _ = interval.tick() => {
                             info!(task = %task_name, "Running full refresh cycle...");
                             let cycle_start = Instant::now();

                             // Define indexer futures
                             let cat_fut = cat_idx_full.update_all_categories(dao_id_full);
                             let user_fut = user_idx_full.update_all_users(dao_id_full);
                             let topic_fut = topic_idx_full.update_all_topics(dao_id_full);
                             let rev_fut = rev_idx_full.update_all_revisions(dao_id_full);

                             // Run indexers concurrently
                             let (cat_res, user_res, topic_res, rev_res): (Result<()>, Result<()>, Result<()>, Result<()>) =
                                 tokio::join!(cat_fut, user_fut, topic_fut, rev_fut);

                             // Record metrics and log results
                             log_indexer_result("Full Categories", &cat_res);

                             log_indexer_result("Full Users", &user_res);

                             log_indexer_result("Full Topics/Posts", &topic_res);

                             log_indexer_result("Full Revisions", &rev_res);

                             info!(task = %task_name, duration = ?cycle_start.elapsed(), "Full refresh cycle finished.");
                        }
                    }
                }
            }
            .instrument(tracing::info_span!("full_refresh_task", dao = %dao_name)),
        );

        // --- Spawn Recent Updates Task ---
        let dao_id_recent = dao_config.id;
        let dao_name_recent = dao_name.clone();
        let cat_idx_recent = category_indexer.clone();
        let user_idx_recent = user_indexer.clone();
        let topic_idx_recent = topic_indexer.clone();
        let rev_idx_recent = revision_indexer.clone();
        let mut shutdown_rx_recent = shutdown_rx.clone();

        indexer_tasks.spawn(
            async move {
                let task_name = format!("recent_updates_{}", dao_name_recent);
                info!(task = %task_name, "Starting recent updates task loop");
                let start_delay = tokio::time::Instant::now() + INITIAL_RECENT_UPDATE_TASK_DELAY;
                let mut interval = interval_at(start_delay, RECENT_UPDATE_INTERVAL);
                interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

                loop {
                    tokio::select! {
                         biased;
                         _ = shutdown_rx_recent.changed() => {
                             info!(task = %task_name, "Received shutdown signal. Exiting recent updates loop.");
                             break;
                         }
                        _ = interval.tick() => {
                             info!(task = %task_name, "Running recent updates cycle...");
                             let cycle_start = Instant::now();

                             // Define futures
                             let cat_fut = cat_idx_recent.update_all_categories(dao_id_recent);
                             let user_fut = user_idx_recent.update_recent_users(dao_id_recent);
                             let topic_fut = topic_idx_recent.update_recent_topics(dao_id_recent);
                             let rev_fut = rev_idx_recent.update_recent_revisions(dao_id_recent);

                             // Run recent updates concurrently
                             let (cat_res,user_res, topic_res, rev_res): (Result<()>, Result<()>, Result<()>, Result<()>) =
                                 tokio::join!(cat_fut,user_fut, topic_fut, rev_fut);

                             // Record metrics and log results
                             log_indexer_result("Full Categories", &cat_res);

                             log_indexer_result("Recent Users", &user_res);

                             log_indexer_result("Recent Topics/Posts", &topic_res);

                             log_indexer_result("Recent Revisions", &rev_res);

                             info!(task = %task_name, duration = ?cycle_start.elapsed(), "Recent updates cycle finished.");
                        }
                    }
                }
            }
            .instrument(tracing::info_span!("recent_updates_task", dao = %dao_name)),
        );
    } // End loop through DAO configs

    // --- Spawn Uptime Heartbeat Task ---
    if let Ok(heartbeat_url) = std::env::var(BETTERSTACK_HEARTBEAT_ENV) {
        if !heartbeat_url.is_empty() {
            info!(url = %heartbeat_url, "Starting Better Uptime heartbeat task.");
            let heartbeat_client = shared_http_client.clone();
            let mut shutdown_rx_heartbeat = shutdown_rx.clone();
            indexer_tasks.spawn(
                async move {
                    let start_delay = tokio::time::Instant::now() + Duration::from_secs(5);
                    let mut interval = interval_at(start_delay, Duration::from_secs(30)); // Send every 30s
                    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
                    loop {
                        tokio::select! {
                             biased;
                             _ = shutdown_rx_heartbeat.changed() => {
                                  info!("Received shutdown signal. Exiting heartbeat loop.");
                                  break;
                             }
                             _ = interval.tick() => {
                                   match heartbeat_client.get(&heartbeat_url).send().await {
                                        Ok(response) if response.status().is_success() => {
                                             debug!("Uptime heartbeat sent successfully.");
                                        }
                                        Ok(response) => {
                                             warn!(status = %response.status(), "Uptime heartbeat request failed with unexpected status.");
                                        }
                                        Err(e) => {
                                             warn!(error = ?e, "Failed to send uptime heartbeat.");
                                        }
                                   }
                             }
                        }
                    }
                }
                .instrument(tracing::info_span!("heartbeat_task")),
            );
        } else {
            warn!(
                "{} environment variable is set but empty. Skipping uptime heartbeat task.",
                BETTERSTACK_HEARTBEAT_ENV
            );
        }
    } else {
        warn!(
            "{} environment variable not set. Skipping uptime heartbeat task.",
            BETTERSTACK_HEARTBEAT_ENV
        );
    }

    // --- Wait for Shutdown Signal ---
    info!("All indexer tasks initialized. Waiting for shutdown signal (Ctrl+C or SIGTERM)...");
    tokio::select! {
         res = signal::ctrl_c() => {
            if let Err(e) = res {
                error!(error = ?e, "Failed to listen for Ctrl+C signal");
            } else {
                info!("Received Ctrl+C signal.");
            }
         },
         res = wait_for_sigterm() => {
             if res.is_ok() {
                 info!("Received SIGTERM signal.");
             }
             // Error already logged in wait_for_sigterm
         }
    }

    // --- Initiate Graceful Shutdown ---
    info!("Initiating graceful shutdown...");
    // Send shutdown signal to all tasks
    shutdown_tx
        .send(())
        .expect("Failed to send shutdown signal");

    // Wait for the health check server to shut down
    info!("Waiting for health check server to shut down...");
    if let Err(e) = server_handle.await {
        error!(error = ?e, "Error waiting for health check server task.");
    } else {
        info!("Health check server task completed.");
    }

    // Wait for all indexer tasks to complete
    info!("Waiting for indexer tasks to complete...");
    while let Some(result) = indexer_tasks.join_next().await {
        match result {
            Ok(_) => debug!("Indexer task completed successfully."),
            Err(e) => error!(error = ?e, "Indexer task failed (panic or cancellation)."),
        }
    }

    info!("All tasks finished. Discourse Indexer application shut down gracefully.");
    opentelemetry::global::shutdown_tracer_provider(); // Ensure tracer provider shuts down
    Ok(())
}

/// Helper function to log the result of an indexer operation.
fn log_indexer_result(task_description: &str, result: &Result<()>) {
    match result {
        Ok(_) => {
            info!("{} update finished successfully.", task_description);
        }
        Err(e) => {
            // Log the full error chain using `{:?}`
            error!(error = ?e, "{} update failed.", task_description);
        }
    }
}

// Helper function to wait for SIGTERM signal
async fn wait_for_sigterm() -> std::io::Result<()> {
    #[cfg(unix)]
    {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
                Ok(())
            }
            Err(e) => {
                error!(error = ?e, "Failed to listen for SIGTERM signal.");
                Err(e)
            }
        }
    }
    #[cfg(not(unix))]
    {
        // On non-Unix platforms, SIGTERM doesn't exist, wait indefinitely
        std::future::pending::<()>().await; // Wait forever
        Ok(())
    }
}
