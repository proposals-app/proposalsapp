//! `SeaORM` Entity, @generated by sea-orm-codegen 1.0.1

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "discourse_post_revision"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub discourse_post_id: Uuid,
    pub external_post_id: i32,
    pub version: i32,
    pub created_at: DateTime,
    pub username: String,
    pub body_changes: String,
    pub edit_reason: Option<String>,
    pub dao_discourse_id: Uuid,
    pub title_changes: Option<String>,
    pub cooked_body_before: Option<String>,
    pub cooked_title_before: Option<String>,
    pub cooked_body_after: Option<String>,
    pub cooked_title_after: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    DiscoursePostId,
    ExternalPostId,
    Version,
    CreatedAt,
    Username,
    BodyChanges,
    EditReason,
    DaoDiscourseId,
    TitleChanges,
    CookedBodyBefore,
    CookedTitleBefore,
    CookedBodyAfter,
    CookedTitleAfter,
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
    DiscoursePost,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::DiscoursePostId => ColumnType::Uuid.def(),
            Self::ExternalPostId => ColumnType::Integer.def(),
            Self::Version => ColumnType::Integer.def(),
            Self::CreatedAt => ColumnType::DateTime.def(),
            Self::Username => ColumnType::Text.def(),
            Self::BodyChanges => ColumnType::Text.def(),
            Self::EditReason => ColumnType::Text.def().null(),
            Self::DaoDiscourseId => ColumnType::Uuid.def(),
            Self::TitleChanges => ColumnType::Text.def().null(),
            Self::CookedBodyBefore => ColumnType::Text.def().null(),
            Self::CookedTitleBefore => ColumnType::Text.def().null(),
            Self::CookedBodyAfter => ColumnType::Text.def().null(),
            Self::CookedTitleAfter => ColumnType::Text.def().null(),
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
            Self::DiscoursePost => Entity::belongs_to(super::discourse_post::Entity)
                .from(Column::DiscoursePostId)
                .to(super::discourse_post::Column::Id)
                .into(),
        }
    }
}

impl Related<super::dao_discourse::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoDiscourse.def()
    }
}

impl Related<super::discourse_post::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscoursePost.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
