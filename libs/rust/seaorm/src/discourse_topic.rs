//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.5

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "discourse_topic"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub external_id: i32,
    pub title: String,
    pub fancy_title: String,
    pub slug: String,
    pub posts_count: i32,
    pub reply_count: i32,
    pub created_at: DateTime,
    pub last_posted_at: DateTime,
    pub bumped_at: DateTime,
    pub pinned: bool,
    pub pinned_globally: bool,
    pub visible: bool,
    pub closed: bool,
    pub archived: bool,
    pub views: i32,
    pub like_count: i32,
    pub category_id: i32,
    pub dao_discourse_id: Uuid,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    ExternalId,
    Title,
    FancyTitle,
    Slug,
    PostsCount,
    ReplyCount,
    CreatedAt,
    LastPostedAt,
    BumpedAt,
    Pinned,
    PinnedGlobally,
    Visible,
    Closed,
    Archived,
    Views,
    LikeCount,
    CategoryId,
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
    DiscoursePost,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::ExternalId => ColumnType::Integer.def(),
            Self::Title => ColumnType::Text.def(),
            Self::FancyTitle => ColumnType::Text.def(),
            Self::Slug => ColumnType::Text.def(),
            Self::PostsCount => ColumnType::Integer.def(),
            Self::ReplyCount => ColumnType::Integer.def(),
            Self::CreatedAt => ColumnType::DateTime.def(),
            Self::LastPostedAt => ColumnType::DateTime.def(),
            Self::BumpedAt => ColumnType::DateTime.def(),
            Self::Pinned => ColumnType::Boolean.def(),
            Self::PinnedGlobally => ColumnType::Boolean.def(),
            Self::Visible => ColumnType::Boolean.def(),
            Self::Closed => ColumnType::Boolean.def(),
            Self::Archived => ColumnType::Boolean.def(),
            Self::Views => ColumnType::Integer.def(),
            Self::LikeCount => ColumnType::Integer.def(),
            Self::CategoryId => ColumnType::Integer.def(),
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
            Self::DiscoursePost => Entity::has_many(super::discourse_post::Entity).into(),
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
