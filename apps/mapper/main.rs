#![warn(unused_extern_crates)]

use anyhow::{Context, Result};
use axum::Router;
use dotenv::dotenv;
use reqwest::Client;
use sea_orm::{ConnectOptions, Database};
use tokio::time::Duration;
use tracing::{error, info, warn};
use utils::tracing::setup_otel;

mod grouper;
mod karma;
mod metrics;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let _otel = setup_otel().await?;

    info!("Application starting up");

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;

    // Start health check server
    let app = Router::new().route("/", axum::routing::get(|| async { "OK" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server_handle = tokio::spawn(async move {
        info!(address = %addr, "Starting health check server");
        if let Err(e) = axum::serve(listener, app).await {
            error!(error = %e, "Health check server error");
        }
    });

    let mut opt = ConnectOptions::new(database_url.to_string());
    opt.sqlx_logging(false);
    let conn = Database::connect(opt).await?;

    // Initialize metrics
    let metrics = metrics::Metrics::new();

    let grouper_conn_ref = conn.clone();
    let grouper_metrics = metrics.clone();
    let grouper_handle = tokio::spawn(async move {
        if let Err(e) = grouper::run_group_task(&grouper_conn_ref, grouper_metrics).await {
            error!(error = %e, "Grouper task runtime error");
        }
    });

    let karma_conn_ref = conn.clone();
    let karma_metrics = metrics.clone();
    let karma_handle = tokio::spawn(async move {
        if let Err(e) = karma::run_karma_task(&karma_conn_ref, karma_metrics).await {
            error!(error = %e, "Karma task runtime error");
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

    // Wait for Ctrl+C or SIGTERM
    let ctrl_c = tokio::signal::ctrl_c();
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("Failed to set up SIGTERM handler");

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down...");
        }
        _ = sigterm.recv() => {
            info!("Received SIGTERM, shutting down...");
        }
    }

    // Clean up tasks
    grouper_handle.abort();
    karma_handle.abort();
    uptime_handle.abort();
    server_handle.abort();

    Ok(())
}
