use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use redis::{AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

pub static REDIS: OnceCell<Client> = OnceCell::new();

pub async fn initialize_redis() -> Result<()> {
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6380".to_string());
    
    info!("Connecting to Redis at: {}", redis_url);
    
    let client = Client::open(redis_url)
        .context("Failed to create Redis client")?;
    
    // Test the connection
    let mut con = client.get_multiplexed_async_connection().await
        .context("Failed to connect to Redis")?;
    
    let _: String = redis::cmd("PING")
        .query_async(&mut con)
        .await
        .context("Failed to ping Redis")?;
    
    info!("Redis connection established successfully");
    
    REDIS.set(client)
        .map_err(|_| anyhow::anyhow!("Failed to set Redis client"))?;
    
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedKeywords {
    pub keywords: Vec<String>,
}

pub async fn get_cached_keywords(key: &str) -> Result<Option<Vec<String>>> {
    let client = REDIS.get()
        .ok_or_else(|| anyhow::anyhow!("Redis not initialized"))?;
    
    let mut con = match client.get_multiplexed_async_connection().await {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to get Redis connection: {}", e);
            return Ok(None); // Return None on connection failure to allow fallback
        }
    };
    
    match con.get::<_, Option<String>>(key).await {
        Ok(Some(data)) => {
            match serde_json::from_str::<CachedKeywords>(&data) {
                Ok(cached) => Ok(Some(cached.keywords)),
                Err(e) => {
                    error!("Failed to deserialize cached keywords: {}", e);
                    Ok(None)
                }
            }
        }
        Ok(None) => Ok(None),
        Err(e) => {
            error!("Redis get error: {}", e);
            Ok(None) // Return None on error to allow fallback
        }
    }
}

pub async fn cache_keywords(key: &str, keywords: &[String], ttl_seconds: u64) -> Result<()> {
    let client = REDIS.get()
        .ok_or_else(|| anyhow::anyhow!("Redis not initialized"))?;
    
    let mut con = match client.get_multiplexed_async_connection().await {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to get Redis connection for caching: {}", e);
            return Ok(()); // Don't fail the operation if caching fails
        }
    };
    
    let cached = CachedKeywords {
        keywords: keywords.to_vec(),
    };
    
    let data = serde_json::to_string(&cached)
        .context("Failed to serialize keywords")?;
    
    match con.set_ex::<_, _, ()>(key, data, ttl_seconds).await {
        Ok(_) => Ok(()),
        Err(e) => {
            error!("Failed to cache keywords: {}", e);
            Ok(()) // Don't fail the operation if caching fails
        }
    }
}