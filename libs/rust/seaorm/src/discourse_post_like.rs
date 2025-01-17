//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.4

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "discourse_post_like"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub external_discourse_post_id: i32,
    pub external_user_id: i32,
    pub created_at: DateTime,
    pub dao_discourse_id: Uuid,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    ExternalDiscoursePostId,
    ExternalUserId,
    CreatedAt,
    DaoDiscourseId,
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
    DaoDiscourse,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::ExternalDiscoursePostId => ColumnType::Integer.def(),
            Self::ExternalUserId => ColumnType::Integer.def(),
            Self::CreatedAt => ColumnType::DateTime.def(),
            Self::DaoDiscourseId => ColumnType::Uuid.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::DaoDiscourse => Entity::belongs_to(super::dao_discourse::Entity)
                .from(Column::DaoDiscourseId)
                .to(super::dao_discourse::Column::Id)
                .into(),
        }
    }
}

impl Related<super::dao_discourse::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoDiscourse.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
