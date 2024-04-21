//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.15

use super::sea_orm_active_enums::Dispatchstatus;
use super::sea_orm_active_enums::Type;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "notification"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub r#type: Type,
    pub dispatchstatus: Dispatchstatus,
    pub proposal_id: Option<String>,
    pub user_id: Option<String>,
    pub submitted_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    Type,
    Dispatchstatus,
    ProposalId,
    UserId,
    SubmittedAt,
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
    Proposal,
    User,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::String(Some(191u32)).def(),
            Self::Type => Type::db_type().def(),
            Self::Dispatchstatus => Dispatchstatus::db_type().def(),
            Self::ProposalId => ColumnType::String(Some(191u32)).def().null(),
            Self::UserId => ColumnType::String(Some(191u32)).def().null(),
            Self::SubmittedAt => ColumnType::DateTime.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::Proposal => Entity::belongs_to(super::proposal::Entity)
                .from(Column::ProposalId)
                .to(super::proposal::Column::Id)
                .into(),
            Self::User => Entity::belongs_to(super::user::Entity)
                .from(Column::UserId)
                .to(super::user::Column::Id)
                .into(),
        }
    }
}

impl Related<super::proposal::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Proposal.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
