use crate::rindexer_lib::typings::{
    networks::{get_arbitrum_provider, get_ethereum_provider},
    rindexer::events::{
        arbitrum_core_governor_abi_gen::RindexerArbitrumCoreGovernorGen::{
            self, RindexerArbitrumCoreGovernorGenInstance,
        },
        arbitrum_sc_nominations_abi_gen::RindexerArbitrumSCNominationsGen::{
            self, RindexerArbitrumSCNominationsGenInstance,
        },
        arbitrum_treasury_governor_abi_gen::RindexerArbitrumTreasuryGovernorGen::{
            self, RindexerArbitrumTreasuryGovernorGenInstance,
        },
        uni_governor_abi_gen::RindexerUniGovernorGen::{self, RindexerUniGovernorGenInstance},
    },
};
use alloy::{network::AnyNetwork, primitives::Address};
use rindexer::provider::RindexerProvider;
use std::sync::Arc;

pub async fn arbitrum_core_governor_contract(
    network: &str,
) -> RindexerArbitrumCoreGovernorGenInstance<Arc<RindexerProvider>, AnyNetwork> {
    let address: Address = "0xf07ded9dc292157749b6fd268e37df6ea38395b9"
        .parse()
        .expect("Invalid address");
    RindexerArbitrumCoreGovernorGen::new(address, provider_for_network(network).await)
}

pub async fn arbitrum_sc_nominations_contract(
    network: &str,
) -> RindexerArbitrumSCNominationsGenInstance<Arc<RindexerProvider>, AnyNetwork> {
    let address: Address = "0x8a1cda8dee421cd06023470608605934c16a05a0"
        .parse()
        .expect("Invalid address");
    RindexerArbitrumSCNominationsGen::new(address, provider_for_network(network).await)
}

pub async fn arbitrum_treasury_governor_contract(
    network: &str,
) -> RindexerArbitrumTreasuryGovernorGenInstance<Arc<RindexerProvider>, AnyNetwork> {
    let address: Address = "0x789fc99093b09ad01c34dc7251d0c89ce743e5a4"
        .parse()
        .expect("Invalid address");
    RindexerArbitrumTreasuryGovernorGen::new(address, provider_for_network(network).await)
}

pub async fn uni_governor_contract(
    network: &str,
) -> RindexerUniGovernorGenInstance<Arc<RindexerProvider>, AnyNetwork> {
    let address: Address = "0x408ed6354d4973f66138c91495f2f2fcbd8724c3"
        .parse()
        .expect("Invalid address");
    RindexerUniGovernorGen::new(address, provider_for_network(network).await)
}

async fn provider_for_network(network: &str) -> Arc<RindexerProvider> {
    match network {
        "ethereum" => get_ethereum_provider().await,
        "arbitrum" => get_arbitrum_provider().await,
        _ => panic!("Network not supported"),
    }
}
