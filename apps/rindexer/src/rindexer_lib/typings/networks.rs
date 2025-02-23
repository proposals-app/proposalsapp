/// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY.
///
/// This file was auto generated by rindexer - https://github.com/joshstevens19/rindexer.
/// Any manual changes to this file will be overwritten.
use ethers::providers::{Http, Provider, RetryClient};
use ethers::types::U64;
use rindexer::{
    lazy_static,
    provider::{create_client, JsonRpcCachedProvider, RetryClientError},
    public_read_env_value, HeaderMap,
};
use std::sync::Arc;

#[allow(dead_code)]
fn create_shadow_client(rpc_url: &str, compute_units_per_second: Option<u64>, max_block_range: Option<U64>, min_block_range: Option<U64>) -> Result<Arc<JsonRpcCachedProvider>, RetryClientError> {
    let mut header = HeaderMap::new();
    header.insert(
        "X-SHADOW-API-KEY",
        public_read_env_value("RINDEXER_PHANTOM_API_KEY")
            .unwrap()
            .parse()
            .unwrap(),
    );
    create_client(
        rpc_url,
        compute_units_per_second,
        max_block_range,
        min_block_range,
        header,
    )
}

lazy_static! {
    static ref ETHEREUM_PROVIDER: Arc<JsonRpcCachedProvider> = create_client(
        &public_read_env_value("ETHEREUM_NODE_URL").unwrap_or("ETHEREUM_NODE_URL".to_string()),
        None,
        Some(U64::from(10000)),
        Some(U64::from(1000)),
        HeaderMap::new()
    )
    .expect("Error creating provider");
    static ref ARBITRUM_PROVIDER: Arc<JsonRpcCachedProvider> = create_client(
        &public_read_env_value("ARBITRUM_NODE_URL").unwrap_or("ARBITRUM_NODE_URL".to_string()),
        None,
        Some(U64::from(10000)),
        Some(U64::from(1000)),
        HeaderMap::new()
    )
    .expect("Error creating provider");
    static ref OPTIMISM_PROVIDER: Arc<JsonRpcCachedProvider> = create_client(
        &public_read_env_value("OPTIMISM_NODE_URL").unwrap_or("OPTIMISM_NODE_URL".to_string()),
        None,
        Some(U64::from(10000)),
        Some(U64::from(1000)),
        HeaderMap::new()
    )
    .expect("Error creating provider");
    static ref POLYGON_PROVIDER: Arc<JsonRpcCachedProvider> = create_client(
        &public_read_env_value("POLYGON_NODE_URL").unwrap_or("POLYGON_NODE_URL".to_string()),
        None,
        Some(U64::from(10000)),
        Some(U64::from(1000)),
        HeaderMap::new()
    )
    .expect("Error creating provider");
    static ref AVALANCHE_PROVIDER: Arc<JsonRpcCachedProvider> = create_client(
        &public_read_env_value("AVALANCHE_NODE_URL").unwrap_or("AVALANCHE_NODE_URL".to_string()),
        None,
        Some(U64::from(10000)),
        Some(U64::from(1000)),
        HeaderMap::new()
    )
    .expect("Error creating provider");
}
pub fn get_ethereum_provider_cache() -> Arc<JsonRpcCachedProvider> {
    Arc::clone(&ETHEREUM_PROVIDER)
}

pub fn get_ethereum_provider() -> Arc<Provider<RetryClient<Http>>> {
    ETHEREUM_PROVIDER.get_inner_provider()
}

pub fn get_arbitrum_provider_cache() -> Arc<JsonRpcCachedProvider> {
    Arc::clone(&ARBITRUM_PROVIDER)
}

pub fn get_arbitrum_provider() -> Arc<Provider<RetryClient<Http>>> {
    ARBITRUM_PROVIDER.get_inner_provider()
}

pub fn get_optimism_provider_cache() -> Arc<JsonRpcCachedProvider> {
    Arc::clone(&OPTIMISM_PROVIDER)
}

pub fn get_optimism_provider() -> Arc<Provider<RetryClient<Http>>> {
    OPTIMISM_PROVIDER.get_inner_provider()
}

pub fn get_polygon_provider_cache() -> Arc<JsonRpcCachedProvider> {
    Arc::clone(&POLYGON_PROVIDER)
}

pub fn get_polygon_provider() -> Arc<Provider<RetryClient<Http>>> {
    POLYGON_PROVIDER.get_inner_provider()
}

pub fn get_avalanche_provider_cache() -> Arc<JsonRpcCachedProvider> {
    Arc::clone(&AVALANCHE_PROVIDER)
}

pub fn get_avalanche_provider() -> Arc<Provider<RetryClient<Http>>> {
    AVALANCHE_PROVIDER.get_inner_provider()
}

pub fn get_provider_cache_for_network(network: &str) -> Arc<JsonRpcCachedProvider> {
    if network == "ethereum" {
        return get_ethereum_provider_cache();
    }

    if network == "arbitrum" {
        return get_arbitrum_provider_cache();
    }

    if network == "optimism" {
        return get_optimism_provider_cache();
    }

    if network == "polygon" {
        return get_polygon_provider_cache();
    }

    if network == "avalanche" {
        return get_avalanche_provider_cache();
    }
    panic!("Network not supported")
}
