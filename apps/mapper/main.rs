#![warn(unused_extern_crates)]

use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use once_cell::sync::OnceCell;
use reqwest::Client;
use sea_orm::DatabaseConnection;
use tokio::time::Duration;
use tracing::{error, info, warn};
use utils::tracing::setup_otel;

mod grouper;
mod karma;

pub static DB: OnceCell<DatabaseConnection> = OnceCell::new();

pub async fn initialize_db() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(25)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(30))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(10 * 60))
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
    let _otel = setup_otel().await?;

    info!("Application starting up");
    initialize_db().await?;

    // Start health check server
    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
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
            if let Err(e) = grouper::run_group_task().await {
                error!(error = %e, "Grouper task runtime error");
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

    Ok(())
}
