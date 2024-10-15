use alloy::providers::{ProviderBuilder, ReqwestProvider};
use anyhow::Result;
use lazy_static::lazy_static;
use std::sync::Arc;

lazy_static! {
    pub static ref ETHEREUM_PROVIDER: Arc<ReqwestProvider> = create_provider("ETHEREUM_NODE_URL");
    pub static ref POLYGON_PROVIDER: Arc<ReqwestProvider> = create_provider("POLYGON_NODE_URL");
    pub static ref ARBITRUM_PROVIDER: Arc<ReqwestProvider> = create_provider("ARBITRUM_NODE_URL");
    pub static ref OPTIMISM_PROVIDER: Arc<ReqwestProvider> = create_provider("OPTIMISM_NODE_URL");
    pub static ref AVALANCHE_PROVIDER: Arc<ReqwestProvider> = create_provider("AVALANCHE_NODE_URL");
}

fn create_provider(env_var: &str) -> Arc<ReqwestProvider> {
    let rpc_url = std::env::var(env_var).unwrap_or_else(|_| panic!("{} not set!", env_var));
    Arc::new(ProviderBuilder::new().on_http(rpc_url.parse().unwrap()))
}

pub fn get_provider(network: &str) -> Result<Arc<ReqwestProvider>> {
    match network.to_lowercase().as_str() {
        "ethereum" => Ok(ETHEREUM_PROVIDER.clone()),
        "polygon" => Ok(POLYGON_PROVIDER.clone()),
        "arbitrum" => Ok(ARBITRUM_PROVIDER.clone()),
        "optimism" => Ok(OPTIMISM_PROVIDER.clone()),
        "avalanche" => Ok(AVALANCHE_PROVIDER.clone()),
        _ => Err(anyhow::anyhow!("Unsupported network: {}", network)),
    }
}
