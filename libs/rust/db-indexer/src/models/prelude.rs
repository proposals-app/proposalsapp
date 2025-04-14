//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.9

pub use super::dao::Entity as Dao;
pub use super::dao_discourse::Entity as DaoDiscourse;
pub use super::dao_governor::Entity as DaoGovernor;
pub use super::delegate::Entity as Delegate;
pub use super::delegate_to_discourse_user::Entity as DelegateToDiscourseUser;
pub use super::delegate_to_voter::Entity as DelegateToVoter;
pub use super::delegation::Entity as Delegation;
pub use super::discourse_category::Entity as DiscourseCategory;
pub use super::discourse_post::Entity as DiscoursePost;
pub use super::discourse_post_like::Entity as DiscoursePostLike;
pub use super::discourse_post_revision::Entity as DiscoursePostRevision;
pub use super::discourse_topic::Entity as DiscourseTopic;
pub use super::discourse_user::Entity as DiscourseUser;
pub use super::job_queue::Entity as JobQueue;
pub use super::kysely_migration::Entity as KyselyMigration;
pub use super::kysely_migration_lock::Entity as KyselyMigrationLock;
pub use super::proposal::Entity as Proposal;
pub use super::proposal_group::Entity as ProposalGroup;
pub use super::vote::Entity as Vote;
pub use super::voter::Entity as Voter;
pub use super::voting_power::Entity as VotingPower;
