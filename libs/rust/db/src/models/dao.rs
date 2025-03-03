//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.5

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "dao"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub picture: String,
    pub background_color: String,
    pub hot: bool,
    pub email_quorum_warning_support: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    Name,
    Slug,
    Picture,
    BackgroundColor,
    Hot,
    EmailQuorumWarningSupport,
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
    DaoIndexer,
    Delegate,
    Delegation,
    GovernorNew,
    Proposal,
    ProposalGroup,
    ProposalNew,
    Subscription,
    Vote,
    VoteNew,
    VotingPower,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::Name => ColumnType::Text.def().unique(),
            Self::Slug => ColumnType::Text.def().unique(),
            Self::Picture => ColumnType::Text.def(),
            Self::BackgroundColor => ColumnType::Text.def(),
            Self::Hot => ColumnType::Boolean.def(),
            Self::EmailQuorumWarningSupport => ColumnType::Boolean.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::DaoDiscourse => Entity::has_many(super::dao_discourse::Entity).into(),
            Self::DaoIndexer => Entity::has_many(super::dao_indexer::Entity).into(),
            Self::Delegate => Entity::has_many(super::delegate::Entity).into(),
            Self::Delegation => Entity::has_many(super::delegation::Entity).into(),
            Self::GovernorNew => Entity::has_many(super::governor_new::Entity).into(),
            Self::Proposal => Entity::has_many(super::proposal::Entity).into(),
            Self::ProposalGroup => Entity::has_many(super::proposal_group::Entity).into(),
            Self::ProposalNew => Entity::has_many(super::proposal_new::Entity).into(),
            Self::Subscription => Entity::has_many(super::subscription::Entity).into(),
            Self::Vote => Entity::has_many(super::vote::Entity).into(),
            Self::VoteNew => Entity::has_many(super::vote_new::Entity).into(),
            Self::VotingPower => Entity::has_many(super::voting_power::Entity).into(),
        }
    }
}

impl Related<super::dao_discourse::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoDiscourse.def()
    }
}

impl Related<super::dao_indexer::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DaoIndexer.def()
    }
}

impl Related<super::delegate::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Delegate.def()
    }
}

impl Related<super::delegation::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Delegation.def()
    }
}

impl Related<super::governor_new::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::GovernorNew.def()
    }
}

impl Related<super::proposal::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Proposal.def()
    }
}

impl Related<super::proposal_group::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProposalGroup.def()
    }
}

impl Related<super::proposal_new::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProposalNew.def()
    }
}

impl Related<super::subscription::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Subscription.def()
    }
}

impl Related<super::vote::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Vote.def()
    }
}

impl Related<super::vote_new::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::VoteNew.def()
    }
}

impl Related<super::voting_power::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::VotingPower.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
