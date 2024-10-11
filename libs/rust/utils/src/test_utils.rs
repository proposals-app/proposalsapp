use chrono::NaiveDateTime;
use sea_orm::prelude::Uuid;
use seaorm::{proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::Value;

pub struct ExpectedProposal {
    pub index_created: i32,
    pub external_id: &'static str,
    pub name: &'static str,
    pub body_contains: Option<Vec<&'static str>>,
    pub url: &'static str,
    pub discussion_url: &'static str,
    pub choices: Value,
    pub scores: Value,
    pub scores_total: f64,
    pub quorum: f64,
    pub scores_quorum: f64,
    pub proposal_state: ProposalState,
    pub marked_spam: Option<bool>,
    pub time_created: NaiveDateTime,
    pub time_start: NaiveDateTime,
    pub time_end: NaiveDateTime,
    pub block_created: Option<i32>,
    pub txid: Option<&'static str>,
    pub metadata: Option<Value>,
}

pub fn assert_proposal(proposal: &proposal::ActiveModel, expected: &ExpectedProposal) {
    assert_eq!(
        proposal.index_created.clone().take().unwrap(),
        expected.index_created,
        "Proposal index_created mismatch"
    );
    assert_eq!(
        proposal.external_id.clone().take().unwrap(),
        expected.external_id,
        "Proposal external_id mismatch"
    );
    assert_eq!(
        proposal.name.clone().take().unwrap(),
        expected.name,
        "Proposal name mismatch"
    );

    if let Some(body_contains) = &expected.body_contains {
        let body = proposal.body.clone().take().unwrap();
        for &expected_str in body_contains {
            assert!(
                body.contains(expected_str),
                "Proposal body does not contain expected string: {}",
                expected_str
            );
        }
    }

    assert_eq!(
        proposal.url.clone().take().unwrap(),
        expected.url,
        "Proposal URL mismatch"
    );
    assert_eq!(
        proposal.discussion_url.clone().take().unwrap(),
        expected.discussion_url,
        "Proposal discussion URL mismatch"
    );
    assert_eq!(
        proposal.choices.clone().take().unwrap(),
        expected.choices,
        "Proposal choices mismatch"
    );
    assert_eq!(
        proposal.scores.clone().take().unwrap(),
        expected.scores,
        "Proposal scores mismatch"
    );
    assert_eq!(
        proposal.scores_total.clone().take().unwrap(),
        expected.scores_total,
        "Proposal scores_total mismatch"
    );
    assert_eq!(
        proposal.quorum.clone().take().unwrap(),
        expected.quorum,
        "Proposal quorum mismatch"
    );
    assert_eq!(
        proposal.scores_quorum.clone().take().unwrap(),
        expected.scores_quorum,
        "Proposal scores_quorum mismatch"
    );
    assert_eq!(
        proposal.proposal_state.clone().take().unwrap(),
        expected.proposal_state,
        "Proposal state mismatch"
    );
    assert_eq!(
        proposal.marked_spam.clone().take(),
        expected.marked_spam,
        "Proposal marked_spam mismatch"
    );
    assert_eq!(
        proposal.time_created.clone().take().unwrap(),
        expected.time_created,
        "Proposal time_created mismatch"
    );
    assert_eq!(
        proposal.time_start.clone().take().unwrap(),
        expected.time_start,
        "Proposal time_start mismatch"
    );
    assert_eq!(
        proposal.time_end.clone().take().unwrap(),
        expected.time_end,
        "Proposal time_end mismatch"
    );
    assert_eq!(
        proposal.block_created.clone().take().flatten(),
        expected.block_created,
        "Proposal block_created mismatch"
    );
    assert_eq!(
        proposal.txid.clone().take().flatten(),
        expected.txid.map(|s| s.to_string()),
        "Proposal txid mismatch"
    );
    assert_eq!(
        proposal.metadata.clone().take().flatten(),
        expected.metadata.clone(),
        "Proposal metadata mismatch"
    );
}

pub struct ExpectedVote {
    pub index_created: i32,
    pub voter_address: &'static str,
    pub choice: Value,
    pub voting_power: f64,
    pub reason: Option<&'static str>,
    pub proposal_external_id: &'static str,
    pub time_created: Option<NaiveDateTime>,
    pub block_created: Option<i32>,
    pub txid: Option<&'static str>,
}

pub fn assert_vote(vote: &vote::ActiveModel, expected: &ExpectedVote) {
    assert_eq!(
        vote.index_created.clone().take().unwrap(),
        expected.index_created,
        "Vote index_created mismatch"
    );
    assert_eq!(
        vote.voter_address.clone().take().unwrap(),
        expected.voter_address,
        "Vote voter_address mismatch"
    );
    assert_eq!(
        vote.choice.clone().take().unwrap(),
        expected.choice,
        "Vote choice mismatch"
    );
    assert_eq!(
        vote.voting_power.clone().take().unwrap(),
        expected.voting_power,
        "Vote voting_power mismatch"
    );
    assert_eq!(
        vote.reason.clone().take().flatten(),
        expected.reason.map(|s| s.to_string()),
        "Vote reason mismatch"
    );
    assert_eq!(
        vote.proposal_external_id.clone().take().unwrap(),
        expected.proposal_external_id,
        "Vote proposal_external_id mismatch"
    );
    assert_eq!(
        vote.time_created.clone().take().flatten(),
        expected.time_created,
        "Vote time_created mismatch"
    );
    assert_eq!(
        vote.block_created.clone().take().flatten(),
        expected.block_created,
        "Vote block_created mismatch"
    );
    assert_eq!(
        vote.txid.clone().take().flatten(),
        expected.txid.map(|s| s.to_string()),
        "Vote txid mismatch"
    );
}

// Helper function to parse datetime strings
pub fn parse_datetime(datetime_str: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S").unwrap()
}
