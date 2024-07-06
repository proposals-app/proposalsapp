//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.15

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "user"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub email: String,
    pub email_verified: bool,
    pub onboarding_step: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    Email,
    EmailVerified,
    OnboardingStep,
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
    EmailVerification,
    Notification,
    Subscription,
    UserPushNotificationSubscription,
    UserSession,
    UserSettings,
    UserToVoter,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::Email => ColumnType::Text.def().unique(),
            Self::EmailVerified => ColumnType::Boolean.def(),
            Self::OnboardingStep => ColumnType::Integer.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::EmailVerification => Entity::has_one(super::email_verification::Entity).into(),
            Self::Notification => Entity::has_many(super::notification::Entity).into(),
            Self::Subscription => Entity::has_many(super::subscription::Entity).into(),
            Self::UserPushNotificationSubscription => {
                Entity::has_many(super::user_push_notification_subscription::Entity).into()
            }
            Self::UserSession => Entity::has_many(super::user_session::Entity).into(),
            Self::UserSettings => Entity::has_one(super::user_settings::Entity).into(),
            Self::UserToVoter => Entity::has_many(super::user_to_voter::Entity).into(),
        }
    }
}

impl Related<super::email_verification::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::EmailVerification.def()
    }
}

impl Related<super::notification::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Notification.def()
    }
}

impl Related<super::subscription::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Subscription.def()
    }
}

impl Related<super::user_push_notification_subscription::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserPushNotificationSubscription.def()
    }
}

impl Related<super::user_session::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserSession.def()
    }
}

impl Related<super::user_settings::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserSettings.def()
    }
}

impl Related<super::user_to_voter::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserToVoter.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
