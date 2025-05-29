#![warn(unused_extern_crates)]

use crate::{
    db_handler::{db, initialize_db},
    discourse_api::DiscourseApi,
    indexers::{categories::CategoryIndexer, revisions::RevisionIndexer, topics::TopicIndexer, users::UserIndexer},
};
use anyhow::{Context, Result};
use axum::{Router, routing::get};
use dotenv::dotenv;
use proposalsapp_db::models::dao_discourse;
use reqwest::Client;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, prelude::Uuid};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{task::JoinSet, time::interval_at};
use tracing::{Instrument, error, info, instrument, warn};
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

            let server = axum::serve(listener, app);

            if let Err(e) = server.await {
                error!(error = ?e, "Health check server error occurred");
            }
            info!("Health check server shut down.");
        }
        .instrument(tracing::info_span!("health_check_server")),
    );

    let uptime_key = std::env::var("BETTERSTACK_KEY").context("BETTERSTACK_KEY must be set")?;
    let client = Client::new();
    tokio::spawn(async move {
        loop {
            match client.get(uptime_key.clone()).send().await {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!("Failed to send uptime ping: {:?}", e),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    // --- Initialize API Clients and Indexers ---
    let dao_discourses = dao_discourse::Entity::find()
        .filter(dao_discourse::Column::Enabled.eq(true))
        .find_with_related(proposalsapp_db::models::dao::Entity)
        .all(db())
        .await
        .context("Failed to fetch enabled DAO Discourse configurations with DAO names")?;

    if dao_discourses.is_empty() {
        warn!("No enabled DAO Discourse configurations found. Indexer will idle.");
        // Wait for server task to potentially exit if binding failed, otherwise it runs indefinitely.
        // The main loop below will not be entered.
        let _ = server_handle.await;
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

        indexer_tasks.spawn(
            async move {
                let task_name = format!("full_refresh_{}", dao_name_full);
                info!(task = %task_name, "Starting full refresh task loop");
                let start_delay = tokio::time::Instant::now() + INITIAL_FULL_REFRESH_TASK_DELAY;
                let mut interval = interval_at(start_delay, FULL_REFRESH_INTERVAL);
                interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

                loop {
                    tokio::select! {
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

        indexer_tasks.spawn(
            async move {
                let task_name = format!("recent_updates_{}", dao_name_recent);
                info!(task = %task_name, "Starting recent updates task loop");
                let start_delay = tokio::time::Instant::now() + INITIAL_RECENT_UPDATE_TASK_DELAY;
                let mut interval = interval_at(start_delay, RECENT_UPDATE_INTERVAL);
                interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

                loop {
                    tokio::select! {
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
    }

    // Keep the health check server task running indefinitely
    // and wait for it to finish (which it won't unless the process is killed)
    if let Err(e) = server_handle.await {
        error!(error = ?e, "Health check server task finished with an error.");
    }

    // The spawned tasks (indexers and heartbeat) and the health check server
    // are now running indefinitely. The main function will effectively
    // complete here, but the tokio runtime will keep running as long as
    // there are active, non-finishing tasks.

    // opentelemetry::global::shutdown_tracer_provider(); // This might prevent metrics export on
    // SIGTERM

    // Note: With shutdown logic removed, Ctrl+C/SIGTERM will terminate the process directly.
    // Tasks are not gracefully shut down.

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
