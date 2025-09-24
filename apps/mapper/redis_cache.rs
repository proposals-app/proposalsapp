use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use redis::Client;
use tracing::info;

pub static REDIS: OnceCell<Client> = OnceCell::new();

pub async fn initialize_redis() -> Result<()> {
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6380".to_string());

    info!("Connecting to Redis at: {}", redis_url);

    let client = Client::open(redis_url).context("Failed to create Redis client")?;

    // Test the connection
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .context("Failed to connect to Redis")?;

    let _: String = redis::cmd("PING")
        .query_async(&mut con)
        .await
        .context("Failed to ping Redis")?;

    info!("Redis connection established successfully");

    REDIS
        .set(client)
        .map_err(|_| anyhow::anyhow!("Failed to set Redis client"))?;

    Ok(())
}
