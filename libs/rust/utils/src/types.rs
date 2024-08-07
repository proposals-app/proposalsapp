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
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProposalsResponse {
    pub inserted_proposals: u32,
    pub updated_proposals: u32,
    pub new_index: i32,
    pub dao_handler_id: Uuid,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VotesJob {
    pub dao_handler_id: Uuid,
    pub proposal_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VotesResponse {
    pub inserted_votes: u32,
    pub updated_votes: u32,
    pub new_index: i32,
    pub dao_handler_id: Uuid,
    pub proposal_id: Option<Uuid>,
}
