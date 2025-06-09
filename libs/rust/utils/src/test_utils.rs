use chrono::NaiveDateTime;
use proposalsapp_db::models::{
    delegation, proposal, sea_orm_active_enums::ProposalState, vote, voting_power,
};
use serde_json::Value;

pub struct ExpectedProposal {
    pub external_id: &'static str,
    pub name: &'static str,
    pub body_contains: Option<Vec<&'static str>>,
    pub url: &'static str,
    pub discussion_url: Option<String>,
    pub choices: Value,
    pub quorum: f64,
    pub scores_quorum: f64,
    pub proposal_state: ProposalState,
    pub marked_spam: Option<bool>,
    pub time_created: NaiveDateTime,
    pub time_start: NaiveDateTime,
    pub time_end: NaiveDateTime,
    pub block_created_at: Option<i32>,
    pub txid: Option<&'static str>,
    pub metadata: Option<Value>,
}

pub fn assert_proposal(proposal: &proposal::ActiveModel, expected: &ExpectedProposal) {
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

    match proposal.discussion_url.clone().take() {
        Some(discussion_url) => assert_eq!(
            discussion_url,
            expected.discussion_url.clone(),
            "Proposal discussion URL mismatch"
        ),
        None => assert!(
            expected.discussion_url.is_none(),
            "Proposal discussion URL mismatch"
        ),
    }

    assert_eq!(
        proposal.choices.clone().take().unwrap(),
        expected.choices,
        "Proposal choices mismatch"
    );

    assert_eq!(
        proposal.quorum.clone().take().unwrap(),
        expected.quorum,
        "Proposal quorum mismatch"
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
        proposal.created_at.clone().take().unwrap(),
        expected.time_created,
        "Proposal time_created mismatch"
    );
    assert_eq!(
        proposal.start_at.clone().take().unwrap(),
        expected.time_start,
        "Proposal time_start mismatch"
    );
    assert_eq!(
        proposal.end_at.clone().take().unwrap(),
        expected.time_end,
        "Proposal time_end mismatch"
    );
    assert_eq!(
        proposal.block_created_at.clone().take().flatten(),
        expected.block_created_at,
        "Proposal block_created_at mismatch"
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
    pub voter_address: &'static str,
    pub choice: Value,
    pub voting_power: f64,
    pub reason: Option<&'static str>,
    pub proposal_external_id: &'static str,
    pub time_created: Option<NaiveDateTime>,
    pub block_created_at: Option<i32>,
    pub txid: Option<&'static str>,
}

pub fn assert_vote(vote: &vote::ActiveModel, expected: &ExpectedVote) {
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
        vote.created_at.clone().take(),
        expected.time_created,
        "Vote time_created mismatch"
    );
    assert_eq!(
        vote.block_created_at.clone().take().flatten(),
        expected.block_created_at,
        "Vote block_created_at mismatch"
    );
    assert_eq!(
        vote.txid.clone().take().flatten(),
        expected.txid.map(|s| s.to_string()),
        "Vote txid mismatch"
    );
}

pub fn parse_datetime(datetime_str: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S").unwrap()
}

pub struct ExpectedDelegation {
    pub delegator: &'static str,
    pub delegate: &'static str,
    pub block: i32,
    pub timestamp: NaiveDateTime,
    pub txid: Option<&'static str>,
}

pub fn assert_delegation(delegation: &delegation::ActiveModel, expected: &ExpectedDelegation) {
    assert_eq!(
        delegation.delegator.clone().take().unwrap(),
        expected.delegator,
        "Delegation delegator mismatch"
    );
    assert_eq!(
        delegation.delegate.clone().take().unwrap(),
        expected.delegate,
        "Delegation delegate mismatch"
    );
    assert_eq!(
        delegation.block.clone().take().unwrap(),
        expected.block,
        "Delegation block mismatch"
    );
    assert_eq!(
        delegation.timestamp.clone().take().unwrap(),
        expected.timestamp,
        "Delegation timestamp mismatch"
    );
    assert_eq!(
        delegation.txid.clone().take().flatten(),
        expected.txid.map(|s| s.to_string()),
        "Delegation txid mismatch"
    );
}

pub struct ExpectedVotingPower {
    pub voter: &'static str,
    pub voting_power: f64,
    pub block: i32,
    pub timestamp: NaiveDateTime,
    pub txid: Option<&'static str>,
}

pub fn assert_voting_power(
    voting_power: &voting_power::ActiveModel,
    expected: &ExpectedVotingPower,
) {
    assert_eq!(
        voting_power.voter.clone().take().unwrap(),
        expected.voter,
        "Voting power voter mismatch"
    );
    assert_eq!(
        voting_power.voting_power.clone().take().unwrap(),
        expected.voting_power,
        "Voting power value mismatch"
    );
    assert_eq!(
        voting_power.block.clone().take().unwrap(),
        expected.block,
        "Voting power block mismatch"
    );
    assert_eq!(
        voting_power.timestamp.clone().take().unwrap(),
        expected.timestamp,
        "Voting power timestamp mismatch"
    );
    assert_eq!(
        voting_power.txid.clone().take().flatten(),
        expected.txid.map(|s| s.to_string()),
        "Voting power txid mismatch"
    );
}
