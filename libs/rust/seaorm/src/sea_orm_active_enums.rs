//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.15

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "dao_handler_enum")]
pub enum DaoHandlerEnum {
    #[sea_orm(string_value = "AAVE_V2_MAINNET")]
    AaveV2Mainnet,
    #[sea_orm(string_value = "AAVE_V3_AVALANCHE")]
    AaveV3Avalanche,
    #[sea_orm(string_value = "AAVE_V3_MAINNET")]
    AaveV3Mainnet,
    #[sea_orm(string_value = "AAVE_V3_POLYGON_POS")]
    AaveV3PolygonPos,
    #[sea_orm(string_value = "ARB_CORE_ARBITRUM")]
    ArbCoreArbitrum,
    #[sea_orm(string_value = "ARB_TREASURY_ARBITRUM")]
    ArbTreasuryArbitrum,
    #[sea_orm(string_value = "COMPOUND_MAINNET")]
    CompoundMainnet,
    #[sea_orm(string_value = "DYDX_MAINNET")]
    DydxMainnet,
    #[sea_orm(string_value = "ENS_MAINNET")]
    EnsMainnet,
    #[sea_orm(string_value = "FRAX_ALPHA_MAINNET")]
    FraxAlphaMainnet,
    #[sea_orm(string_value = "FRAX_OMEGA_MAINNET")]
    FraxOmegaMainnet,
    #[sea_orm(string_value = "GITCOIN_MAINNET")]
    GitcoinMainnet,
    #[sea_orm(string_value = "GITCOIN_V2_MAINNET")]
    GitcoinV2Mainnet,
    #[sea_orm(string_value = "HOP_MAINNET")]
    HopMainnet,
    #[sea_orm(string_value = "INTEREST_PROTOCOL_MAINNET")]
    InterestProtocolMainnet,
    #[sea_orm(string_value = "MAKER_EXECUTIVE_MAINNET")]
    MakerExecutiveMainnet,
    #[sea_orm(string_value = "MAKER_POLL_ARBITRUM")]
    MakerPollArbitrum,
    #[sea_orm(string_value = "MAKER_POLL_MAINNET")]
    MakerPollMainnet,
    #[sea_orm(string_value = "NOUNS_PROPOSALS_MAINNET")]
    NounsProposalsMainnet,
    #[sea_orm(string_value = "OP_OPTIMISM")]
    OpOptimism,
    #[sea_orm(string_value = "SNAPSHOT")]
    Snapshot,
    #[sea_orm(string_value = "UNISWAP_MAINNET")]
    UniswapMainnet,
    #[sea_orm(string_value = "ZEROX_PROTOCOL_MAINNET")]
    ZeroxProtocolMainnet,
}
#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(
    rs_type = "String",
    db_type = "Enum",
    enum_name = "notification_dispatched_state_enum"
)]
pub enum NotificationDispatchedStateEnum {
    #[sea_orm(string_value = "DELETED")]
    Deleted,
    #[sea_orm(string_value = "DISPATCHED")]
    Dispatched,
    #[sea_orm(string_value = "FAILED")]
    Failed,
    #[sea_orm(string_value = "FIRST_RETRY")]
    FirstRetry,
    #[sea_orm(string_value = "NOT_DISPATCHED")]
    NotDispatched,
    #[sea_orm(string_value = "SECOND_RETRY")]
    SecondRetry,
    #[sea_orm(string_value = "THIRD_RETRY")]
    ThirdRetry,
}
#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(
    rs_type = "String",
    db_type = "Enum",
    enum_name = "notification_type_enum"
)]
pub enum NotificationTypeEnum {
    #[sea_orm(string_value = "BULLETIN_EMAIL")]
    BulletinEmail,
    #[sea_orm(string_value = "QUORUM_NOT_REACHED_EMAIL")]
    QuorumNotReachedEmail,
    #[sea_orm(string_value = "TIMEEND_EMAIL")]
    TimeendEmail,
}
#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(
    rs_type = "String",
    db_type = "Enum",
    enum_name = "proposal_state_enum"
)]
pub enum ProposalStateEnum {
    #[sea_orm(string_value = "ACTIVE")]
    Active,
    #[sea_orm(string_value = "CANCELED")]
    Canceled,
    #[sea_orm(string_value = "DEFEATED")]
    Defeated,
    #[sea_orm(string_value = "EXECUTED")]
    Executed,
    #[sea_orm(string_value = "EXPIRED")]
    Expired,
    #[sea_orm(string_value = "HIDDEN")]
    Hidden,
    #[sea_orm(string_value = "PENDING")]
    Pending,
    #[sea_orm(string_value = "QUEUED")]
    Queued,
    #[sea_orm(string_value = "SUCCEEDED")]
    Succeeded,
    #[sea_orm(string_value = "UNKNOWN")]
    Unknown,
}
