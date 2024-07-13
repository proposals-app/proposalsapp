mod aave_v2;
mod aave_v3;
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
mod nouns;
mod optimism;
mod snapshot;
mod uniswap;

use aave_v2::AaveV2Handler;
use aave_v3::AaveV3Handler;
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
use nouns::NounsHandler;
use optimism::OptimismHandler;
use seaorm::sea_orm_active_enums::DaoHandlerEnumV2;
use snapshot::SnapshotHandler;
use uniswap::UniswapHandler;

use crate::ProposalHandler;

pub fn get_handler(handler_type: &DaoHandlerEnumV2) -> Box<dyn ProposalHandler> {
    match handler_type {
        DaoHandlerEnumV2::AaveV2Mainnet => Box::new(AaveV2Handler),
        DaoHandlerEnumV2::AaveV3Mainnet => Box::new(AaveV3Handler),
        DaoHandlerEnumV2::CompoundMainnet => Box::new(CompoundHandler),
        DaoHandlerEnumV2::AaveV3Avalanche => todo!(),
        DaoHandlerEnumV2::AaveV3PolygonPos => todo!(),
        DaoHandlerEnumV2::ArbCoreArbitrum => Box::new(ArbitrumCoreHandler),
        DaoHandlerEnumV2::ArbTreasuryArbitrum => Box::new(ArbitrumTreasuryHandler),
        DaoHandlerEnumV2::DydxMainnet => Box::new(DydxHandler),
        DaoHandlerEnumV2::EnsMainnet => Box::new(EnsHandler),
        DaoHandlerEnumV2::FraxAlphaMainnet => Box::new(FraxAlphaHandler),
        DaoHandlerEnumV2::FraxOmegaMainnet => Box::new(FraxOmegaHandler),
        DaoHandlerEnumV2::GitcoinMainnet => Box::new(GitcoinV1Handler),
        DaoHandlerEnumV2::GitcoinV2Mainnet => Box::new(GitcoinV2Handler),
        DaoHandlerEnumV2::HopMainnet => Box::new(HopHandler),
        DaoHandlerEnumV2::MakerExecutiveMainnet => Box::new(MakerExecutiveHandler),
        DaoHandlerEnumV2::MakerPollArbitrum => todo!(),
        DaoHandlerEnumV2::MakerPollMainnet => Box::new(MakerPollHandler),
        DaoHandlerEnumV2::NounsProposalsMainnet => Box::new(NounsHandler),
        DaoHandlerEnumV2::OpOptimism => Box::new(OptimismHandler),
        DaoHandlerEnumV2::Snapshot => Box::new(SnapshotHandler),
        DaoHandlerEnumV2::UniswapMainnet => Box::new(UniswapHandler),
    }
}
