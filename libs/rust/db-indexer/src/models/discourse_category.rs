//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.8

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "discourse_category"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub external_id: i32,
    pub name: String,
    pub color: String,
    pub text_color: String,
    pub slug: String,
    pub topic_count: i32,
    pub post_count: i32,
    pub description: Option<String>,
    pub description_text: Option<String>,
    pub topics_day: Option<i32>,
    pub topics_week: Option<i32>,
    pub topics_month: Option<i32>,
    pub topics_year: Option<i32>,
    pub topics_all_time: Option<i32>,
    pub dao_discourse_id: Uuid,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    ExternalId,
    Name,
    Color,
    TextColor,
    Slug,
    TopicCount,
    PostCount,
    Description,
    DescriptionText,
    TopicsDay,
    TopicsWeek,
    TopicsMonth,
    TopicsYear,
    TopicsAllTime,
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
            Self::ExternalId => ColumnType::Integer.def(),
            Self::Name => ColumnType::Text.def(),
            Self::Color => ColumnType::Text.def(),
            Self::TextColor => ColumnType::Text.def(),
            Self::Slug => ColumnType::Text.def(),
            Self::TopicCount => ColumnType::Integer.def(),
            Self::PostCount => ColumnType::Integer.def(),
            Self::Description => ColumnType::Text.def().null(),
            Self::DescriptionText => ColumnType::Text.def().null(),
            Self::TopicsDay => ColumnType::Integer.def().null(),
            Self::TopicsWeek => ColumnType::Integer.def().null(),
            Self::TopicsMonth => ColumnType::Integer.def().null(),
            Self::TopicsYear => ColumnType::Integer.def().null(),
            Self::TopicsAllTime => ColumnType::Integer.def().null(),
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
