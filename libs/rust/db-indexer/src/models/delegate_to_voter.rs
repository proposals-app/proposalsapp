//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.9

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "delegate_to_voter"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub delegate_id: Uuid,
    pub voter_id: Uuid,
    pub period_start: DateTime,
    pub period_end: DateTime,
    pub proof: Option<Json>,
    pub verified: bool,
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    DelegateId,
    VoterId,
    PeriodStart,
    PeriodEnd,
    Proof,
    Verified,
    CreatedAt,
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
    Delegate,
    Voter,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::DelegateId => ColumnType::Uuid.def(),
            Self::VoterId => ColumnType::Uuid.def(),
            Self::PeriodStart => ColumnType::DateTime.def(),
            Self::PeriodEnd => ColumnType::DateTime.def(),
            Self::Proof => ColumnType::JsonBinary.def().null(),
            Self::Verified => ColumnType::Boolean.def(),
            Self::CreatedAt => ColumnType::DateTime.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::Delegate => Entity::belongs_to(super::delegate::Entity)
                .from(Column::DelegateId)
                .to(super::delegate::Column::Id)
                .into(),
            Self::Voter => Entity::belongs_to(super::voter::Entity)
                .from(Column::VoterId)
                .to(super::voter::Column::Id)
                .into(),
        }
    }
}

impl Related<super::delegate::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Delegate.def()
    }
}

impl Related<super::voter::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Voter.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
