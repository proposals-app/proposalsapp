use sea_orm::prelude::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ProposalGroupItem {
    Topic(TopicItem),
    Proposal(ProposalItem),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopicItem {
    pub name: String,
    pub external_id: String,
    pub dao_discourse_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProposalItem {
    pub name: String,
    pub governor_id: Uuid,
    pub external_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobType {
    MapperNewProposalDiscussion,
    MapperNewSnapshotProposal,
}

impl std::fmt::Display for JobType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobType::MapperNewProposalDiscussion => write!(f, "MAPPER_NEW_PROPOSAL_DISCUSSION"),
            JobType::MapperNewSnapshotProposal => write!(f, "MAPPER_NEW_SNAPSHOT_PROPOSAL"),
        }
    }
}

impl std::str::FromStr for JobType {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "MAPPER_NEW_PROPOSAL_DISCUSSION" => Ok(JobType::MapperNewProposalDiscussion),
            "MAPPER_NEW_SNAPSHOT_PROPOSAL" => Ok(JobType::MapperNewSnapshotProposal),
            _ => Err(anyhow::anyhow!("Unknown job type: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscussionJobData {
    pub discourse_topic_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProposalJobData {
    pub proposal_id: Uuid,
}

pub trait JobData: Serialize {
    fn job_type() -> JobType;
}

impl JobData for DiscussionJobData {
    fn job_type() -> JobType {
        JobType::MapperNewProposalDiscussion
    }
}

impl JobData for ProposalJobData {
    fn job_type() -> JobType {
        JobType::MapperNewSnapshotProposal
    }
}
