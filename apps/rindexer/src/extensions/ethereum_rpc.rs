use alloy::{
    primitives::Address,
    transports::http::reqwest::header::HeaderMap,
};
use anyhow::Result;
use rindexer::{
    manifest::network::BlockPollFrequency,
    provider::{JsonRpcCachedProvider, RindexerProvider, create_client},
};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::OnceCell;
use tracing::info;

// Static providers for eth_call support
static ETHEREUM_ETHCALL_PROVIDER: OnceCell<Arc<JsonRpcCachedProvider>> = OnceCell::const_new();
static ARBITRUM_ETHCALL_PROVIDER: OnceCell<Arc<JsonRpcCachedProvider>> = OnceCell::const_new();
static OPTIMISM_ETHCALL_PROVIDER: OnceCell<Arc<JsonRpcCachedProvider>> = OnceCell::const_new();
static POLYGON_ETHCALL_PROVIDER: OnceCell<Arc<JsonRpcCachedProvider>> = OnceCell::const_new();
static AVALANCHE_ETHCALL_PROVIDER: OnceCell<Arc<JsonRpcCachedProvider>> = OnceCell::const_new();

// Map of providers
static PROVIDERS: OnceCell<HashMap<String, OnceCell<Arc<JsonRpcCachedProvider>>>> =
    OnceCell::const_new();

// Free public RPC endpoints that support eth_call
const RPC_ENDPOINTS: &[(&str, &str, u64)] = &[
    ("ethereum", "https://eth.llamarpc.com", 1),
    ("arbitrum", "https://arbitrum.llamarpc.com", 42161),
    ("optimism", "https://optimism.llamarpc.com", 10),
    ("polygon", "https://polygon.llamarpc.com", 137),
    ("avalanche", "https://avalanche.llamarpc.com", 43114),
];

/// Initialize the ethereum RPC extension
pub async fn initialize_ethereum_rpc() -> Result<()> {
    info!("Initializing Ethereum RPC extension for eth_call support");

    // Initialize providers map
    let mut providers_map = HashMap::new();
    for (network, _, _) in RPC_ENDPOINTS {
        providers_map.insert(network.to_string(), OnceCell::const_new());
    }
    PROVIDERS
        .set(providers_map)
        .map_err(|_| anyhow::anyhow!("Failed to initialize providers map"))?;

    Ok(())
}

/// Get provider for eth_call operations
pub async fn get_ethcall_provider(network: &str) -> Result<Arc<RindexerProvider>> {
    let provider_cache = get_ethcall_provider_cache(network).await?;
    Ok(provider_cache.get_inner_provider())
}

/// Get cached provider for eth_call operations
pub async fn get_ethcall_provider_cache(network: &str) -> Result<Arc<JsonRpcCachedProvider>> {
    match network {
        "ethereum" => Ok(get_ethereum_ethcall_provider_cache().await),
        "arbitrum" => Ok(get_arbitrum_ethcall_provider_cache().await),
        "optimism" => Ok(get_optimism_ethcall_provider_cache().await),
        "polygon" => Ok(get_polygon_ethcall_provider_cache().await),
        "avalanche" => Ok(get_avalanche_ethcall_provider_cache().await),
        _ => Err(anyhow::anyhow!(
            "Network {} not supported for eth_call",
            network
        )),
    }
}

async fn get_ethereum_ethcall_provider_cache() -> Arc<JsonRpcCachedProvider> {
    ETHEREUM_ETHCALL_PROVIDER
        .get_or_init(|| async {
            create_client(
                "https://eth.llamarpc.com",
                1,
                None,
                None,
                Some(BlockPollFrequency::RpcOptimized),
                HeaderMap::new(),
                None,
            )
            .await
            .expect("Error creating ethereum ethcall provider")
        })
        .await
        .clone()
}

async fn get_arbitrum_ethcall_provider_cache() -> Arc<JsonRpcCachedProvider> {
    ARBITRUM_ETHCALL_PROVIDER
        .get_or_init(|| async {
            create_client(
                "https://arbitrum.llamarpc.com",
                42161,
                None,
                None,
                Some(BlockPollFrequency::RpcOptimized),
                HeaderMap::new(),
                None,
            )
            .await
            .expect("Error creating arbitrum ethcall provider")
        })
        .await
        .clone()
}

async fn get_optimism_ethcall_provider_cache() -> Arc<JsonRpcCachedProvider> {
    OPTIMISM_ETHCALL_PROVIDER
        .get_or_init(|| async {
            create_client(
                "https://optimism.llamarpc.com",
                10,
                None,
                None,
                Some(BlockPollFrequency::RpcOptimized),
                HeaderMap::new(),
                None,
            )
            .await
            .expect("Error creating optimism ethcall provider")
        })
        .await
        .clone()
}

async fn get_polygon_ethcall_provider_cache() -> Arc<JsonRpcCachedProvider> {
    POLYGON_ETHCALL_PROVIDER
        .get_or_init(|| async {
            create_client(
                "https://polygon.llamarpc.com",
                137,
                None,
                None,
                Some(BlockPollFrequency::RpcOptimized),
                HeaderMap::new(),
                None,
            )
            .await
            .expect("Error creating polygon ethcall provider")
        })
        .await
        .clone()
}

async fn get_avalanche_ethcall_provider_cache() -> Arc<JsonRpcCachedProvider> {
    AVALANCHE_ETHCALL_PROVIDER
        .get_or_init(|| async {
            create_client(
                "https://avalanche.llamarpc.com",
                43114,
                None,
                None,
                Some(BlockPollFrequency::RpcOptimized),
                HeaderMap::new(),
                None,
            )
            .await
            .expect("Error creating avalanche ethcall provider")
        })
        .await
        .clone()
}

/// Contract creation functions that use eth_call providers
/// These functions create contract instances that use public RPC endpoints for eth_call operations

// Re-export the contract creation functions with eth_call provider support
use crate::rindexer_lib::typings::rindexer::events::{
    uni_governor::uni_governor_abi_gen::RindexerUniGovernorGen,
    arbitrum_core_governor::arbitrum_core_governor_abi_gen::RindexerArbitrumCoreGovernorGen,
    arbitrum_treasury_governor::arbitrum_treasury_governor_abi_gen::RindexerArbitrumTreasuryGovernorGen,
    arbitrum_sc_nominations::arbitrum_sc_nominations_abi_gen::RindexerArbitrumScNominationsGen,
};

/// Creates a uni_governor contract instance using eth_call provider
pub async fn uni_governor_contract_ethcall(
    _network: &str,  // We ignore the network param and always use ethereum for uni_governor
) -> RindexerUniGovernorGen::RindexerUniGovernorGenInstance<Arc<RindexerProvider>> {
    let provider = get_ethcall_provider("ethereum")
        .await
        .expect("Failed to get eth_call provider");
    
    let address: Address = "0x408ed6354d4973f66138c91495f2f2fcbd8724c3"
        .parse()
        .expect("Invalid address");
    
    RindexerUniGovernorGen::new(address, provider)
}

/// Creates an arbitrum_core_governor contract instance using eth_call provider
pub async fn arbitrum_core_governor_contract_ethcall(
    _network: &str,  // We ignore the network param and always use arbitrum
) -> RindexerArbitrumCoreGovernorGen::RindexerArbitrumCoreGovernorGenInstance<Arc<RindexerProvider>> {
    let provider = get_ethcall_provider("arbitrum")
        .await
        .expect("Failed to get eth_call provider");
    
    let address: Address = "0xf07ded9dc292157749b6fd268e37df6ea38395b9"
        .parse()
        .expect("Invalid address");
    
    RindexerArbitrumCoreGovernorGen::new(address, provider)
}

/// Creates an arbitrum_treasury_governor contract instance using eth_call provider
pub async fn arbitrum_treasury_governor_contract_ethcall(
    _network: &str,  // We ignore the network param and always use arbitrum
) -> RindexerArbitrumTreasuryGovernorGen::RindexerArbitrumTreasuryGovernorGenInstance<Arc<RindexerProvider>> {
    let provider = get_ethcall_provider("arbitrum")
        .await
        .expect("Failed to get eth_call provider");
    
    let address: Address = "0x789fc99093b09ad01c34dc7251d0c89ce743e5a4"
        .parse()
        .expect("Invalid address");
    
    RindexerArbitrumTreasuryGovernorGen::new(address, provider)
}

/// Creates an arbitrum_sc_nominations contract instance using eth_call provider
pub async fn arbitrum_sc_nominations_contract_ethcall(
    _network: &str,  // We ignore the network param and always use arbitrum
) -> RindexerArbitrumScNominationsGen::RindexerArbitrumScNominationsGenInstance<Arc<RindexerProvider>> {
    let provider = get_ethcall_provider("arbitrum")
        .await
        .expect("Failed to get eth_call provider");
    
    let address: Address = "0x8a1cda8dee421cbbb41f4aa62e1dc5569e8e1056"
        .parse()
        .expect("Invalid address");
    
    RindexerArbitrumScNominationsGen::new(address, provider)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_ethereum_provider() {
        let provider = get_ethcall_provider("ethereum").await;
        assert!(provider.is_ok());
    }

    #[tokio::test]
    async fn test_get_arbitrum_provider() {
        let provider = get_ethcall_provider("arbitrum").await;
        assert!(provider.is_ok());
    }

    #[tokio::test]
    async fn test_unsupported_network() {
        let provider = get_ethcall_provider("unsupported").await;
        assert!(provider.is_err());
    }
}