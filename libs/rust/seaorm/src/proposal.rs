//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.4

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
    pub id: Uuid,
    pub index_created: i32,
    pub external_id: String,
    pub name: String,
    pub body: String,
    pub url: String,
    pub discussion_url: Option<String>,
    pub choices: Json,
    pub scores: Json,
    pub scores_total: f64,
    pub quorum: f64,
    pub scores_quorum: f64,
    pub proposal_state: ProposalState,
    pub marked_spam: bool,
    pub created_at: DateTime,
    pub start_at: DateTime,
    pub end_at: DateTime,
    pub block_created: Option<i32>,
    pub txid: Option<String>,
    pub metadata: Option<Json>,
    pub dao_indexer_id: Uuid,
    pub dao_id: Uuid,
    pub author: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    IndexCreated,
    ExternalId,
    Name,
    Body,
    Url,
    DiscussionUrl,
    Choices,
    Scores,
    ScoresTotal,
    Quorum,
    ScoresQuorum,
    ProposalState,
    MarkedSpam,
    CreatedAt,
    StartAt,
    EndAt,
    BlockCreated,
    Txid,
    Metadata,
    DaoIndexerId,
    DaoId,
    Author,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    Id,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = Uuid;
    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    Dao,
    DaoIndexer,
    Vote,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::IndexCreated => ColumnType::Integer.def(),
            Self::ExternalId => ColumnType::Text.def(),
            Self::Name => ColumnType::Text.def(),
            Self::Body => ColumnType::Text.def(),
            Self::Url => ColumnType::Text.def(),
            Self::DiscussionUrl => ColumnType::Text.def().null(),
            Self::Choices => ColumnType::JsonBinary.def(),
            Self::Scores => ColumnType::JsonBinary.def(),
            Self::ScoresTotal => ColumnType::Double.def(),
            Self::Quorum => ColumnType::Double.def(),
            Self::ScoresQuorum => ColumnType::Double.def(),
            Self::ProposalState => ProposalState::db_type().def(),
            Self::MarkedSpam => ColumnType::Boolean.def(),
            Self::CreatedAt => ColumnType::DateTime.def(),
            Self::StartAt => ColumnType::DateTime.def(),
            Self::EndAt => ColumnType::DateTime.def(),
            Self::BlockCreated => ColumnType::Integer.def().null(),
            Self::Txid => ColumnType::Text.def().null(),
            Self::Metadata => ColumnType::JsonBinary.def().null(),
            Self::DaoIndexerId => ColumnType::Uuid.def(),
            Self::DaoId => ColumnType::Uuid.def(),
            Self::Author => ColumnType::Text.def().null(),
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
            Self::DaoIndexer => Entity::belongs_to(super::dao_indexer::Entity)
                .from(Column::DaoIndexerId)
                .to(super::dao_indexer::Column::Id)
                .into(),
            Self::Vote => Entity::has_many(super::vote::Entity).into(),
        }
    }
}

impl Related<super::dao::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dao.def()
    }
}

impl Related<super::dao_indexer::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoIndexer.def()
    }
}

impl Related<super::vote::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Vote.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
