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
mod interest_protocol;
mod lido;
mod maker_executive;
mod maker_poll;
mod nouns;
mod optimism;
mod snapshot;
mod uniswap;
mod zerox_protocol;

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
use interest_protocol::InterestProtocolHandler;
use maker_executive::MakerExecutiveHandler;
use maker_poll::MakerPollHandler;
use nouns::NounsHandler;
use optimism::OptimismHandler;
use seaorm::sea_orm_active_enums::DaoHandlerEnum;
use snapshot::SnapshotHandler;
use uniswap::UniswapHandler;
use zerox_protocol::ZeroxProtocolHandler;

use crate::ProposalHandler;

pub fn get_handler(handler_type: &DaoHandlerEnum) -> Box<dyn ProposalHandler> {
    match handler_type {
        DaoHandlerEnum::AaveV2Mainnet => Box::new(AaveV2Handler),
        DaoHandlerEnum::AaveV3Mainnet => Box::new(AaveV3Handler),
        DaoHandlerEnum::CompoundMainnet => Box::new(CompoundHandler),
        DaoHandlerEnum::AaveV3Avalanche => todo!(),
        DaoHandlerEnum::AaveV3PolygonPos => todo!(),
        DaoHandlerEnum::ArbCoreArbitrum => Box::new(ArbitrumCoreHandler),
        DaoHandlerEnum::ArbTreasuryArbitrum => Box::new(ArbitrumTreasuryHandler),
        DaoHandlerEnum::DydxMainnet => Box::new(DydxHandler),
        DaoHandlerEnum::EnsMainnet => Box::new(EnsHandler),
        DaoHandlerEnum::FraxAlphaMainnet => Box::new(FraxAlphaHandler),
        DaoHandlerEnum::FraxOmegaMainnet => Box::new(FraxOmegaHandler),
        DaoHandlerEnum::GitcoinMainnet => Box::new(GitcoinV1Handler),
        DaoHandlerEnum::GitcoinV2Mainnet => Box::new(GitcoinV2Handler),
        DaoHandlerEnum::HopMainnet => Box::new(HopHandler),
        DaoHandlerEnum::InterestProtocolMainnet => Box::new(InterestProtocolHandler),
        DaoHandlerEnum::MakerExecutiveMainnet => Box::new(MakerExecutiveHandler),
        DaoHandlerEnum::MakerPollArbitrum => todo!(),
        DaoHandlerEnum::MakerPollMainnet => Box::new(MakerPollHandler),
        DaoHandlerEnum::NounsProposalsMainnet => Box::new(NounsHandler),
        DaoHandlerEnum::OpOptimism => Box::new(OptimismHandler),
        DaoHandlerEnum::Snapshot => Box::new(SnapshotHandler),
        DaoHandlerEnum::UniswapMainnet => Box::new(UniswapHandler),
        DaoHandlerEnum::ZeroxProtocolMainnet => Box::new(ZeroxProtocolHandler),
    }
}
