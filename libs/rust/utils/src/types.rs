use ::serde::{Deserialize, Serialize};
use sea_orm::prelude::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProposalGroupItem {
    pub id: String,
    #[serde(rename = "type")]
    pub type_field: String,
    pub name: String,
    #[serde(rename = "indexerName")]
    pub indexer_name: String,
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
