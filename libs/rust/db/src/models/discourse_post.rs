//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.13

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "discourse_post"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub external_id: i32,
    pub name: Option<String>,
    pub username: String,
    pub created_at: DateTime,
    pub cooked: Option<String>,
    pub post_number: i32,
    pub post_type: i32,
    pub updated_at: DateTime,
    pub reply_count: i32,
    pub reply_to_post_number: Option<i32>,
    pub quote_count: i32,
    pub incoming_link_count: i32,
    pub reads: i32,
    pub readers_count: i32,
    pub score: f64,
    pub topic_id: i32,
    pub topic_slug: String,
    pub display_username: Option<String>,
    pub primary_group_name: Option<String>,
    pub flair_name: Option<String>,
    pub flair_url: Option<String>,
    pub flair_bg_color: Option<String>,
    pub flair_color: Option<String>,
    pub version: i32,
    pub user_id: i32,
    pub dao_discourse_id: Uuid,
    pub can_view_edit_history: bool,
    pub deleted: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    ExternalId,
    Name,
    Username,
    CreatedAt,
    Cooked,
    PostNumber,
    PostType,
    UpdatedAt,
    ReplyCount,
    ReplyToPostNumber,
    QuoteCount,
    IncomingLinkCount,
    Reads,
    ReadersCount,
    Score,
    TopicId,
    TopicSlug,
    DisplayUsername,
    PrimaryGroupName,
    FlairName,
    FlairUrl,
    FlairBgColor,
    FlairColor,
    Version,
    UserId,
    DaoDiscourseId,
    CanViewEditHistory,
    Deleted,
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
    DiscoursePostRevision,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::ExternalId => ColumnType::Integer.def(),
            Self::Name => ColumnType::Text.def().null(),
            Self::Username => ColumnType::Text.def(),
            Self::CreatedAt => ColumnType::DateTime.def(),
            Self::Cooked => ColumnType::Text.def().null(),
            Self::PostNumber => ColumnType::Integer.def(),
            Self::PostType => ColumnType::Integer.def(),
            Self::UpdatedAt => ColumnType::DateTime.def(),
            Self::ReplyCount => ColumnType::Integer.def(),
            Self::ReplyToPostNumber => ColumnType::Integer.def().null(),
            Self::QuoteCount => ColumnType::Integer.def(),
            Self::IncomingLinkCount => ColumnType::Integer.def(),
            Self::Reads => ColumnType::Integer.def(),
            Self::ReadersCount => ColumnType::Integer.def(),
            Self::Score => ColumnType::Double.def(),
            Self::TopicId => ColumnType::Integer.def(),
            Self::TopicSlug => ColumnType::Text.def(),
            Self::DisplayUsername => ColumnType::Text.def().null(),
            Self::PrimaryGroupName => ColumnType::Text.def().null(),
            Self::FlairName => ColumnType::Text.def().null(),
            Self::FlairUrl => ColumnType::Text.def().null(),
            Self::FlairBgColor => ColumnType::Text.def().null(),
            Self::FlairColor => ColumnType::Text.def().null(),
            Self::Version => ColumnType::Integer.def(),
            Self::UserId => ColumnType::Integer.def(),
            Self::DaoDiscourseId => ColumnType::Uuid.def(),
            Self::CanViewEditHistory => ColumnType::Boolean.def(),
            Self::Deleted => ColumnType::Boolean.def(),
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
            Self::DiscoursePostRevision => {
                Entity::has_many(super::discourse_post_revision::Entity).into()
            }
        }
    }
}

impl Related<super::dao_discourse::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoDiscourse.def()
    }
}

impl Related<super::discourse_post_revision::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DiscoursePostRevision.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
