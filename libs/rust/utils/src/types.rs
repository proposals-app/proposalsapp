use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProposalsJob {
    pub dao_handler_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProposalsResponse {
    pub inserted_proposals: u32,
    pub updated_proposals: u32,
    pub new_index: i64,
    pub dao_handler_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VotesJob {
    pub dao_handler_id: String,
    pub proposal_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VotesResponse {
    pub inserted_votes: u32,
    pub updated_votes: u32,
    pub new_index: i64,
    pub dao_handler_id: String,
    pub proposal_id: Option<String>,
}
