#![warn(unused_extern_crates)]
use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use once_cell::sync::OnceCell;
use reqwest::Client;
use sea_orm::DatabaseConnection;
use std::future::Future;
use tokio::{sync::watch, time::Duration};
use tracing::{error, info, warn};
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

mod config;
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
    opt.max_connections(25)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(15))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(5 * 60))
        .max_lifetime(Duration::from_secs(30 * 60))
        .test_before_acquire(true)
        .map_sqlx_postgres_opts(|opts| opts.statement_cache_capacity(200))
        .sqlx_logging(false);
    let db = sea_orm::Database::connect(opt)
        .await
        .context("Failed to connect to the database")?;
    DB.set(db)
        .map_err(|_| anyhow::anyhow!("Failed to set database connection"))
}

fn spawn_periodic_task<F, Fut>(
    name: &'static str,
    interval: Duration,
    mut shutdown: watch::Receiver<bool>,
    mut task: F,
) -> tokio::task::JoinHandle<()>
where
    F: FnMut() -> Fut + Send + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(interval);

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    info!(task = name, "Running task");
                    task().await;
                    info!(task = name, "Task completed");
                }
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        info!(task = name, "Stopping task");
                        break;
                    }
                }
            }
        }
    })
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"))
        .add_directive("hyper_util=off".parse().unwrap())
        .add_directive("alloy_rpc_client=off".parse().unwrap())
        .add_directive("reqwest=off".parse().unwrap())
        .add_directive("alloy_transport_http=off".parse().unwrap())
        .add_directive("llm_client=off".parse().unwrap())
        .add_directive("llm_client::=off".parse().unwrap())
        .add_directive("llm_interface=off".parse().unwrap())
        .add_directive("llm_interface::=off".parse().unwrap())
        .add_directive("llm_models=off".parse().unwrap())
        .add_directive("llm_models::=off".parse().unwrap())
        .add_directive("llm_devices=off".parse().unwrap())
        .add_directive("llama_cpp_rs=off".parse().unwrap())
        .add_directive("llama_cpp_sys=off".parse().unwrap())
        .add_directive("llm=off".parse().unwrap())
        .add_directive("tokenizers=off".parse().unwrap())
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
    config::load()?;
    info!("Initializing database connection...");
    initialize_db().await?;
    info!("Database connection established");

    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let mut health_server_handle = tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
        }
    });

    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let mut grouper_handle = spawn_periodic_task(
        "grouper",
        Duration::from_secs(60),
        shutdown_rx.clone(),
        || async {
            match crate::grouper::run_grouper_task().await {
                Ok(results) => {
                    info!("URL-based grouper completed successfully");

                    #[cfg(feature = "llm-grouping")]
                    {
                        let db = crate::DB.get().expect("Database not initialized");
                        let semantic = semantic_grouper::SemanticGrouper::new(db.clone());

                        for (dao_id, result) in results.results {
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

                    #[cfg(not(feature = "llm-grouping"))]
                    let _ = results;

                    info!("Grouper task completed successfully");
                }
                Err(e) => error!(error = %e, "Grouper task runtime error"),
            }
        },
    );

    let mut karma_handle = spawn_periodic_task(
        "karma",
        Duration::from_secs(30 * 60),
        shutdown_rx.clone(),
        || async {
            if let Err(e) = karma::run_karma_task().await {
                error!(error = %e, "Karma task runtime error");
            }
        },
    );

    let uptime_key = std::env::var("BETTERSTACK_KEY").context("BETTERSTACK_KEY must be set")?;
    let client = Client::new();
    let mut uptime_handle = spawn_periodic_task(
        "uptime",
        Duration::from_secs(10),
        shutdown_rx.clone(),
        move || {
            let client = client.clone();
            let uptime_key = uptime_key.clone();
            async move {
                match client.get(uptime_key.clone()).send().await {
                    Ok(_) => info!("Uptime ping sent successfully"),
                    Err(e) => warn!("Failed to send uptime ping: {:?}", e),
                }
            }
        },
    );

    info!("All tasks started, application running indefinitely");

    tokio::select! {
        result = &mut health_server_handle => {
            error!("Health server task completed unexpectedly: {:?}", result);
        }
        result = &mut grouper_handle => {
            error!("Grouper task completed unexpectedly: {:?}", result);
        }
        result = &mut karma_handle => {
            error!("Karma task completed unexpectedly: {:?}", result);
        }
        result = &mut uptime_handle => {
            error!("Uptime task completed unexpectedly: {:?}", result);
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down gracefully");
        }
    }

    let _ = shutdown_tx.send(true);
    let _ = tokio::join!(grouper_handle, karma_handle, uptime_handle);
    health_server_handle.abort();

    info!("Application shutting down");
    Ok(())
}
