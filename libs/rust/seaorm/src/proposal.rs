//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.14

use super::sea_orm_active_enums::ProposalState;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "proposal"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub index_created: i64,
    pub votes_fetched: i8,
    pub votes_refresh_speed: i64,
    pub votes_index: i64,
    pub external_id: String,
    pub name: String,
    pub body: String,
    pub url: String,
    pub discussion_url: String,
    pub choices: Json,
    pub scores: Json,
    pub scores_total: f64,
    pub quorum: f64,
    pub proposal_state: ProposalState,
    pub flagged: i8,
    pub block_created: Option<i64>,
    pub time_created: Option<DateTime>,
    pub time_start: DateTime,
    pub time_end: DateTime,
    pub dao_handler_id: String,
    pub dao_id: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    IndexCreated,
    VotesFetched,
    VotesRefreshSpeed,
    VotesIndex,
    ExternalId,
    Name,
    Body,
    Url,
    DiscussionUrl,
    Choices,
    Scores,
    ScoresTotal,
    Quorum,
    ProposalState,
    Flagged,
    BlockCreated,
    TimeCreated,
    TimeStart,
    TimeEnd,
    DaoHandlerId,
    DaoId,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    Id,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = String;
    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    Dao,
    DaoHandler,
    Notification,
    Vote,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::String(Some(191u32)).def(),
            Self::IndexCreated => ColumnType::BigInteger.def(),
            Self::VotesFetched => ColumnType::TinyInteger.def(),
            Self::VotesRefreshSpeed => ColumnType::BigInteger.def(),
            Self::VotesIndex => ColumnType::BigInteger.def(),
            Self::ExternalId => ColumnType::String(Some(191u32)).def(),
            Self::Name => ColumnType::custom("LONGTEXT").def(),
            Self::Body => ColumnType::custom("LONGTEXT").def(),
            Self::Url => ColumnType::custom("LONGTEXT").def(),
            Self::DiscussionUrl => ColumnType::custom("LONGTEXT").def(),
            Self::Choices => ColumnType::Json.def(),
            Self::Scores => ColumnType::Json.def(),
            Self::ScoresTotal => ColumnType::Double.def(),
            Self::Quorum => ColumnType::Double.def(),
            Self::ProposalState => ProposalState::db_type().def(),
            Self::Flagged => ColumnType::TinyInteger.def(),
            Self::BlockCreated => ColumnType::BigInteger.def().null(),
            Self::TimeCreated => ColumnType::DateTime.def().null(),
            Self::TimeStart => ColumnType::DateTime.def(),
            Self::TimeEnd => ColumnType::DateTime.def(),
            Self::DaoHandlerId => ColumnType::String(Some(191u32)).def(),
            Self::DaoId => ColumnType::String(Some(191u32)).def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::Dao => Entity::belongs_to(super::dao::Entity)
                .from(Column::DaoId)
                .to(super::dao::Column::Id)
                .into(),
            Self::DaoHandler => Entity::belongs_to(super::dao_handler::Entity)
                .from(Column::DaoHandlerId)
                .to(super::dao_handler::Column::Id)
                .into(),
            Self::Notification => Entity::has_many(super::notification::Entity).into(),
            Self::Vote => Entity::has_many(super::vote::Entity).into(),
        }
    }
}

impl Related<super::dao::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dao.def()
    }
}

impl Related<super::dao_handler::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoHandler.def()
    }
}

impl Related<super::notification::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Notification.def()
    }
}

impl Related<super::vote::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Vote.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
