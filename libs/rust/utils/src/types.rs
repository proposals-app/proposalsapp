use sea_orm::prelude::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum JobType {
    Proposals = 0,
    Votes = 1,
}

impl JobType {
    pub fn as_str(&self) -> &str {
        match self {
            JobType::Proposals => "proposals-job",
            JobType::Votes => "votes-job",
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProposalsJob {
    pub dao_handler_id: Uuid,
    pub from_index: i32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VotesJob {
    pub dao_handler_id: Uuid,
    pub proposal_id: Option<Uuid>,
}
