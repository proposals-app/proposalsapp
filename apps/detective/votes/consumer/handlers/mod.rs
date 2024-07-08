mod aave_v2;
mod aave_v3_avalanche;
mod aave_v3_mainnet;
mod aave_v3_polygon;
mod arbitrum_core;
mod arbitrum_treasury;
mod compound;
mod dydx;
mod ens;
mod frax_alpha;
mod frax_omega;
mod gitcoin_v1;
mod gitcoin_v2;
mod hop;
mod interest_protocol;
mod maker_executive;
mod maker_poll;
mod maker_poll_arbitrum;
mod nouns;
mod optimism;
mod snapshot;
mod uniswap;
mod zerox_protocol;

use aave_v2::AaveV2Handler;
use aave_v3_avalanche::AaveV3AvalancheHandler;
use aave_v3_mainnet::AaveV3MainnetHandler;
use aave_v3_polygon::AaveV3PolygonHandler;
use arbitrum_core::ArbitrumCoreHandler;
use arbitrum_treasury::ArbitrumTreasuryHandler;
use compound::CompoundHandler;
use dydx::DydxHandler;
use ens::EnsHandler;
use frax_alpha::FraxAlphaHandler;
use frax_omega::FraxOmegaHandler;
use gitcoin_v1::GitcoinV1Handler;
use gitcoin_v2::GitcoinV2Handler;
use hop::HopHandler;
use interest_protocol::InterestProtocolHandler;
use maker_executive::MakerExecutiveHandler;
use maker_poll::MakerPollHandler;
use maker_poll_arbitrum::MakerPollArbitrumHandler;
use nouns::NounsHandler;
use optimism::OptimismHandler;
use seaorm::sea_orm_active_enums::DaoHandlerEnum;
use snapshot::SnapshotHandler;
use uniswap::UniswapHandler;
use zerox_protocol::ZeroxProtocolHandler;

use crate::VotesHandler;

pub fn get_handler(handler_type: &DaoHandlerEnum) -> Box<dyn VotesHandler> {
    match handler_type {
        DaoHandlerEnum::AaveV2Mainnet => Box::new(AaveV2Handler),
        DaoHandlerEnum::AaveV3Avalanche => Box::new(AaveV3AvalancheHandler),
        DaoHandlerEnum::AaveV3Mainnet => Box::new(AaveV3MainnetHandler),
        DaoHandlerEnum::AaveV3PolygonPos => Box::new(AaveV3PolygonHandler),
        DaoHandlerEnum::ArbCoreArbitrum => Box::new(ArbitrumCoreHandler),
        DaoHandlerEnum::ArbTreasuryArbitrum => Box::new(ArbitrumTreasuryHandler),
        DaoHandlerEnum::CompoundMainnet => Box::new(CompoundHandler),
        DaoHandlerEnum::DydxMainnet => Box::new(DydxHandler),
        DaoHandlerEnum::EnsMainnet => Box::new(EnsHandler),
        DaoHandlerEnum::FraxAlphaMainnet => Box::new(FraxAlphaHandler),
        DaoHandlerEnum::FraxOmegaMainnet => Box::new(FraxOmegaHandler),
        DaoHandlerEnum::GitcoinMainnet => Box::new(GitcoinV1Handler),
        DaoHandlerEnum::GitcoinV2Mainnet => Box::new(GitcoinV2Handler),
        DaoHandlerEnum::HopMainnet => Box::new(HopHandler),
        DaoHandlerEnum::InterestProtocolMainnet => Box::new(InterestProtocolHandler),
        DaoHandlerEnum::MakerExecutiveMainnet => Box::new(MakerExecutiveHandler),
        DaoHandlerEnum::MakerPollArbitrum => Box::new(MakerPollArbitrumHandler),
        DaoHandlerEnum::MakerPollMainnet => Box::new(MakerPollHandler),
        DaoHandlerEnum::NounsProposalsMainnet => Box::new(NounsHandler),
        DaoHandlerEnum::OpOptimism => Box::new(OptimismHandler),
        DaoHandlerEnum::Snapshot => Box::new(SnapshotHandler),
        DaoHandlerEnum::UniswapMainnet => Box::new(UniswapHandler),
        DaoHandlerEnum::ZeroxProtocolMainnet => Box::new(ZeroxProtocolHandler),
    }
}
