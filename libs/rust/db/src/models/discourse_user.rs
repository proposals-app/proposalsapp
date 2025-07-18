//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.13

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "discourse_user"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub external_id: i32,
    pub username: String,
    pub name: Option<String>,
    pub avatar_template: String,
    pub title: Option<String>,
    pub likes_received: Option<i64>,
    pub likes_given: Option<i64>,
    pub topics_entered: Option<i64>,
    pub topic_count: Option<i64>,
    pub post_count: Option<i64>,
    pub posts_read: Option<i64>,
    pub days_visited: Option<i64>,
    pub dao_discourse_id: Uuid,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    ExternalId,
    Username,
    Name,
    AvatarTemplate,
    Title,
    LikesReceived,
    LikesGiven,
    TopicsEntered,
    TopicCount,
    PostCount,
    PostsRead,
    DaysVisited,
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
    DelegateToDiscourseUser,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::ExternalId => ColumnType::Integer.def(),
            Self::Username => ColumnType::Text.def(),
            Self::Name => ColumnType::Text.def().null(),
            Self::AvatarTemplate => ColumnType::Text.def(),
            Self::Title => ColumnType::Text.def().null(),
            Self::LikesReceived => ColumnType::BigInteger.def().null(),
            Self::LikesGiven => ColumnType::BigInteger.def().null(),
            Self::TopicsEntered => ColumnType::BigInteger.def().null(),
            Self::TopicCount => ColumnType::BigInteger.def().null(),
            Self::PostCount => ColumnType::BigInteger.def().null(),
            Self::PostsRead => ColumnType::BigInteger.def().null(),
            Self::DaysVisited => ColumnType::BigInteger.def().null(),
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
            Self::DelegateToDiscourseUser => {
                Entity::has_many(super::delegate_to_discourse_user::Entity).into()
            }
        }
    }
}

impl Related<super::dao_discourse::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoDiscourse.def()
    }
}

impl Related<super::delegate_to_discourse_user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DelegateToDiscourseUser.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
