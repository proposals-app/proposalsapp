//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.9

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "dao_discourse"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub dao_id: Uuid,
    pub discourse_base_url: String,
    pub enabled: bool,
    pub with_user_agent: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    DaoId,
    DiscourseBaseUrl,
    Enabled,
    WithUserAgent,
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
    DiscourseCategory,
    DiscoursePost,
    DiscoursePostLike,
    DiscoursePostRevision,
    DiscourseTopic,
    DiscourseUser,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::DaoId => ColumnType::Uuid.def(),
            Self::DiscourseBaseUrl => ColumnType::Text.def(),
            Self::Enabled => ColumnType::Boolean.def(),
            Self::WithUserAgent => ColumnType::Boolean.def(),
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
            Self::DiscourseCategory => Entity::has_many(super::discourse_category::Entity).into(),
            Self::DiscoursePost => Entity::has_many(super::discourse_post::Entity).into(),
            Self::DiscoursePostLike => Entity::has_many(super::discourse_post_like::Entity).into(),
            Self::DiscoursePostRevision => Entity::has_many(super::discourse_post_revision::Entity).into(),
            Self::DiscourseTopic => Entity::has_many(super::discourse_topic::Entity).into(),
            Self::DiscourseUser => Entity::has_many(super::discourse_user::Entity).into(),
        }
    }
}

impl Related<super::dao::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dao.def()
    }
}

impl Related<super::discourse_category::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscourseCategory.def()
    }
}

impl Related<super::discourse_post::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscoursePost.def()
    }
}

impl Related<super::discourse_post_like::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscoursePostLike.def()
    }
}

impl Related<super::discourse_post_revision::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscoursePostRevision.def()
    }
}

impl Related<super::discourse_topic::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscourseTopic.def()
    }
}

impl Related<super::discourse_user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscourseUser.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
