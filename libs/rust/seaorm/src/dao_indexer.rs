//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.4

use super::sea_orm_active_enums::IndexerType;
use super::sea_orm_active_enums::IndexerVariant;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "dao_indexer"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub dao_id: Uuid,
    pub enabled: bool,
    pub indexer_type: IndexerType,
    pub indexer_variant: IndexerVariant,
    pub index: i32,
    pub speed: i32,
    pub portal_url: Option<String>,
    pub updated_at: DateTime,
    pub name: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    DaoId,
    Enabled,
    IndexerType,
    IndexerVariant,
    Index,
    Speed,
    PortalUrl,
    UpdatedAt,
    Name,
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
    Proposal,
    Vote,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::DaoId => ColumnType::Uuid.def(),
            Self::Enabled => ColumnType::Boolean.def(),
            Self::IndexerType => IndexerType::db_type().def(),
            Self::IndexerVariant => IndexerVariant::db_type().def(),
            Self::Index => ColumnType::Integer.def(),
            Self::Speed => ColumnType::Integer.def(),
            Self::PortalUrl => ColumnType::Text.def().null(),
            Self::UpdatedAt => ColumnType::DateTime.def(),
            Self::Name => ColumnType::Text.def().null(),
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
            Self::Proposal => Entity::has_many(super::proposal::Entity).into(),
            Self::Vote => Entity::has_many(super::vote::Entity).into(),
        }
    }
}

impl Related<super::dao::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dao.def()
    }
}

impl Related<super::proposal::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Proposal.def()
    }
}

impl Related<super::vote::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Vote.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
