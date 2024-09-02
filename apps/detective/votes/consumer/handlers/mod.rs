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
mod optimism_old;
mod optimism_type_1;
mod optimism_type_2;
mod optimism_type_3;
mod optimism_type_4;
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
use optimism_old::OptimismOldHandler;
use optimism_type_1::OptimismType1Handler;
use optimism_type_2::OptimismType2Handler;
use optimism_type_3::OptimismType3Handler;
use optimism_type_4::OptimismType4Handler;
use seaorm::sea_orm_active_enums::DaoHandlerEnumV3;
use snapshot::SnapshotHandler;
use uniswap::UniswapHandler;

use crate::VotesHandler;

pub fn get_handler(handler_type: &DaoHandlerEnumV3) -> Box<dyn VotesHandler> {
    match handler_type {
        DaoHandlerEnumV3::AaveV2Mainnet => Box::new(AaveV2Handler),
        DaoHandlerEnumV3::AaveV3Avalanche => Box::new(AaveV3AvalancheHandler),
        DaoHandlerEnumV3::AaveV3Mainnet => Box::new(AaveV3MainnetHandler),
        DaoHandlerEnumV3::AaveV3PolygonPos => Box::new(AaveV3PolygonHandler),
        DaoHandlerEnumV3::ArbCoreArbitrum => Box::new(ArbitrumCoreHandler),
        DaoHandlerEnumV3::ArbTreasuryArbitrum => Box::new(ArbitrumTreasuryHandler),
        DaoHandlerEnumV3::CompoundMainnet => Box::new(CompoundHandler),
        DaoHandlerEnumV3::DydxMainnet => Box::new(DydxHandler),
        DaoHandlerEnumV3::EnsMainnet => Box::new(EnsHandler),
        DaoHandlerEnumV3::FraxAlphaMainnet => Box::new(FraxAlphaHandler),
        DaoHandlerEnumV3::FraxOmegaMainnet => Box::new(FraxOmegaHandler),
        DaoHandlerEnumV3::GitcoinMainnet => Box::new(GitcoinV1Handler),
        DaoHandlerEnumV3::GitcoinV2Mainnet => Box::new(GitcoinV2Handler),
        DaoHandlerEnumV3::HopMainnet => Box::new(HopHandler),
        DaoHandlerEnumV3::MakerExecutiveMainnet => Box::new(MakerExecutiveHandler),
        DaoHandlerEnumV3::MakerPollArbitrum => Box::new(MakerPollArbitrumHandler),
        DaoHandlerEnumV3::MakerPollMainnet => Box::new(MakerPollHandler),
        DaoHandlerEnumV3::NounsProposalsMainnet => Box::new(NounsHandler),
        DaoHandlerEnumV3::OpOptimismOld => Box::new(OptimismOldHandler),
        DaoHandlerEnumV3::Snapshot => Box::new(SnapshotHandler),
        DaoHandlerEnumV3::UniswapMainnet => Box::new(UniswapHandler),
        DaoHandlerEnumV3::OpOptimismType1 => Box::new(OptimismType1Handler),
        DaoHandlerEnumV3::OpOptimismType2 => Box::new(OptimismType2Handler),
        DaoHandlerEnumV3::OpOptimismType3 => Box::new(OptimismType3Handler),
        DaoHandlerEnumV3::OpOptimismType4 => Box::new(OptimismType4Handler),
    }
}
