#![warn(unused_extern_crates)]
use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use once_cell::sync::OnceCell;
use reqwest::Client;
use sea_orm::DatabaseConnection;
use tokio::time::Duration;
use tracing::{error, info, warn};
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

#[cfg(feature = "llm-grouping")]
mod embeddings;
mod grouper;
mod karma;
#[cfg(feature = "llm-grouping")]
mod semantic_grouper;

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();

pub async fn initialize_db() -> Result<()> {
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;
    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(25) // Increased to handle concurrent operations
        .min_connections(5)
        .connect_timeout(Duration::from_secs(15))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(5 * 60))
        .max_lifetime(Duration::from_secs(30 * 60))
        .sqlx_logging(false);
    let db = sea_orm::Database::connect(opt)
        .await
        .context("Failed to connect to the database")?;
    DB.set(db)
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    // Initialize JSON logging for stdout
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"))
        // HTTP/networking crates
        .add_directive("hyper_util=off".parse().unwrap())
        .add_directive("alloy_rpc_client=off".parse().unwrap())
        .add_directive("reqwest=off".parse().unwrap())
        .add_directive("alloy_transport_http=off".parse().unwrap())
        // LLM-related crates - use wildcard patterns to catch all modules
        .add_directive("llm_client=off".parse().unwrap())
        .add_directive("llm_client::=off".parse().unwrap()) // All submodules
        .add_directive("llm_interface=off".parse().unwrap())
        .add_directive("llm_interface::=off".parse().unwrap())
        .add_directive("llm_models=off".parse().unwrap())
        .add_directive("llm_models::=off".parse().unwrap())
        .add_directive("llm_devices=off".parse().unwrap())
        .add_directive("llama_cpp_rs=off".parse().unwrap())
        .add_directive("llama_cpp_sys=off".parse().unwrap())
        .add_directive("llm=off".parse().unwrap())
        // Tokenizers
        .add_directive("tiktoken_rs=off".parse().unwrap())
        .add_directive("tokenizers=off".parse().unwrap())
        // Other potential LLM-related crates
        .add_directive("fastembed=off".parse().unwrap())
        .add_directive("ort=off".parse().unwrap())
        .add_directive("candle=off".parse().unwrap())
        .add_directive("candle_core=off".parse().unwrap());

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

    info!("Mapper service starting up");
    info!("Initializing database connection...");
    initialize_db().await?;
    info!("Database connection established");

    // Start health check server
    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let health_server_handle = tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
        }
    });

    let grouper_handle = tokio::spawn(async move {
        // Run the grouper task every 1 minute
        let interval = Duration::from_secs(60);
        loop {
            info!("Running grouper task");

            match crate::grouper::run_grouper_task().await {
                Ok(_results) => {
                    info!("URL-based grouper completed successfully");

                    // Run semantic grouping if the feature is enabled
                    #[cfg(feature = "llm-grouping")]
                    {
                        let db = crate::DB.get().expect("Database not initialized");
                        let semantic = semantic_grouper::SemanticGrouper::new(db.clone());

                        for (dao_id, result) in _results.results {
                            info!(dao_id = %dao_id, "Running semantic grouping");
                            match semantic
                                .run_semantic_grouping(dao_id, result.url_matched_proposal_ids)
                                .await
                            {
                                Ok(applied) => {
                                    info!(
                                        dao_id = %dao_id,
                                        semantic_matches_applied = applied,
                                        "Semantic grouping completed"
                                    );
                                }
                                Err(e) => {
                                    error!(
                                        dao_id = %dao_id,
                                        error = %e,
                                        error_chain = ?e,
                                        "Semantic grouping failed"
                                    );
                                }
                            }
                        }
                    }

                    info!("Grouper task completed successfully");
                }
                Err(e) => error!(error = %e, "Grouper task runtime error"),
            }

            info!(
                "Grouper task completed, sleeping for {} seconds",
                interval.as_secs()
            );
            tokio::time::sleep(interval).await;
        }
    });

    let karma_handle = tokio::spawn(async move {
        // Run the karma task every 30 minutes
        let interval = Duration::from_secs(30 * 60);
        loop {
            info!("Running karma task");
            if let Err(e) = karma::run_karma_task().await {
                error!(error = %e, "Karma task runtime error");
            }
            info!(
                "Karma task completed, sleeping for {} seconds",
                interval.as_secs()
            );
            tokio::time::sleep(interval).await;
        }
    });

    // Uptime ping task
    let uptime_key = std::env::var("BETTERSTACK_KEY").context("BETTERSTACK_KEY must be set")?;
    let client = Client::new();
    let uptime_handle = tokio::spawn(async move {
        loop {
            match client.get(uptime_key.clone()).send().await {
                Ok(_) => info!("Uptime ping sent successfully"),
                Err(e) => warn!("Failed to send uptime ping: {:?}", e),
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    info!("All tasks started, application running indefinitely");

    // Option 1: Wait for any task to complete (if one fails, shutdown gracefully)
    tokio::select! {
        result = health_server_handle => {
            error!("Health server task completed unexpectedly: {:?}", result);
        }
        result = grouper_handle => {
            error!("Grouper task completed unexpectedly: {:?}", result);
        }
        result = karma_handle => {
            error!("Karma task completed unexpectedly: {:?}", result);
        }
        result = uptime_handle => {
            error!("Uptime task completed unexpectedly: {:?}", result);
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down gracefully");
        }
    }

    info!("Application shutting down");
    Ok(())
}
