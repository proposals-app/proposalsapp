//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.5

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "vote_new"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub voter_address: String,
    pub choice: Json,
    pub voting_power: f64,
    pub reason: Option<String>,
    pub created_at: DateTime,
    pub block_created_at: Option<i32>,
    pub txid: Option<String>,
    pub proposal_external_id: String,
    pub proposal_id: Uuid,
    pub dao_id: Uuid,
    pub indexer_id: Uuid,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    VoterAddress,
    Choice,
    VotingPower,
    Reason,
    CreatedAt,
    BlockCreatedAt,
    Txid,
    ProposalExternalId,
    ProposalId,
    DaoId,
    IndexerId,
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
    Proposal,
    Voter,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::VoterAddress => ColumnType::Text.def(),
            Self::Choice => ColumnType::JsonBinary.def(),
            Self::VotingPower => ColumnType::Double.def(),
            Self::Reason => ColumnType::Text.def().null(),
            Self::CreatedAt => ColumnType::DateTime.def(),
            Self::BlockCreatedAt => ColumnType::Integer.def().null(),
            Self::Txid => ColumnType::Text.def().null(),
            Self::ProposalExternalId => ColumnType::Text.def(),
            Self::ProposalId => ColumnType::Uuid.def(),
            Self::DaoId => ColumnType::Uuid.def(),
            Self::IndexerId => ColumnType::Uuid.def(),
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
                .from(Column::IndexerId)
                .to(super::dao_indexer::Column::Id)
                .into(),
            Self::Proposal => Entity::belongs_to(super::proposal::Entity)
                .from(Column::ProposalId)
                .to(super::proposal::Column::Id)
                .into(),
            Self::Voter => Entity::belongs_to(super::voter::Entity)
                .from(Column::VoterAddress)
                .to(super::voter::Column::Address)
                .into(),
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

impl Related<super::proposal::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Proposal.def()
    }
}

impl Related<super::voter::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Voter.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
