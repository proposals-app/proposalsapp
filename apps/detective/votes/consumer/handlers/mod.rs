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
mod lido;
mod maker_executive;
mod maker_poll;
mod maker_poll_arbitrum;
mod nouns;
mod optimism;
mod snapshot;
mod uniswap;

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
use maker_executive::MakerExecutiveHandler;
use maker_poll::MakerPollHandler;
use maker_poll_arbitrum::MakerPollArbitrumHandler;
use nouns::NounsHandler;
use optimism::OptimismHandler;
use seaorm::sea_orm_active_enums::DaoHandlerEnumV4;
use snapshot::SnapshotHandler;
use uniswap::UniswapHandler;

use crate::VotesHandler;

pub fn get_handler(handler_type: &DaoHandlerEnumV4) -> Box<dyn VotesHandler> {
    match handler_type {
        DaoHandlerEnumV4::AaveV2Mainnet => Box::new(AaveV2Handler),
        DaoHandlerEnumV4::AaveV3Avalanche => Box::new(AaveV3AvalancheHandler),
        DaoHandlerEnumV4::AaveV3Mainnet => Box::new(AaveV3MainnetHandler),
        DaoHandlerEnumV4::AaveV3PolygonPos => Box::new(AaveV3PolygonHandler),
        DaoHandlerEnumV4::ArbCoreArbitrum => Box::new(ArbitrumCoreHandler),
        DaoHandlerEnumV4::ArbTreasuryArbitrum => Box::new(ArbitrumTreasuryHandler),
        DaoHandlerEnumV4::CompoundMainnet => Box::new(CompoundHandler),
        DaoHandlerEnumV4::DydxMainnet => Box::new(DydxHandler),
        DaoHandlerEnumV4::EnsMainnet => Box::new(EnsHandler),
        DaoHandlerEnumV4::FraxAlphaMainnet => Box::new(FraxAlphaHandler),
        DaoHandlerEnumV4::FraxOmegaMainnet => Box::new(FraxOmegaHandler),
        DaoHandlerEnumV4::GitcoinMainnet => Box::new(GitcoinV1Handler),
        DaoHandlerEnumV4::GitcoinV2Mainnet => Box::new(GitcoinV2Handler),
        DaoHandlerEnumV4::HopMainnet => Box::new(HopHandler),
        DaoHandlerEnumV4::MakerExecutiveMainnet => Box::new(MakerExecutiveHandler),
        DaoHandlerEnumV4::MakerPollArbitrum => Box::new(MakerPollArbitrumHandler),
        DaoHandlerEnumV4::MakerPollMainnet => Box::new(MakerPollHandler),
        DaoHandlerEnumV4::NounsProposalsMainnet => Box::new(NounsHandler),
        DaoHandlerEnumV4::Snapshot => Box::new(SnapshotHandler),
        DaoHandlerEnumV4::UniswapMainnet => Box::new(UniswapHandler),
        DaoHandlerEnumV4::OpOptimism => Box::new(OptimismHandler),
    }
}
