use chrono::NaiveDateTime;
use sea_orm::prelude::Uuid;
use seaorm::{proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::Value;

pub struct ExpectedProposal {
    pub index_created: i32,
    pub external_id: &'static str,
    pub name: &'static str,
    pub body_contains: Vec<&'static str>,
    pub url: &'static str,
    pub discussion_url: &'static str,
    pub choices: &'static str,
    pub scores: &'static str,
    pub scores_total: f64,
    pub quorum: f64,
    pub scores_quorum: f64,
    pub proposal_state: ProposalState,
    pub flagged_spam: Option<bool>,
    pub block_created: Option<i32>,
    pub time_created: Option<&'static str>,
    pub time_start: &'static str,
    pub time_end: &'static str,
    pub votes_fetched: Option<bool>,
    pub votes_refresh_speed: Option<i32>,
    pub votes_index: Option<i32>,
    pub metadata: Option<Value>,
}

pub fn assert_proposal(
    proposal: &proposal::ActiveModel,
    expected: &ExpectedProposal,
    dao_id: Uuid,
) {
    assert_eq!(
        proposal.index_created.clone().take(),
        Some(expected.index_created),
        "Index created does not match: expected {}, got {:?}",
        expected.index_created,
        proposal.index_created.clone().take()
    );

    assert_eq!(
        proposal.external_id.clone().take(),
        Some(expected.external_id.to_string()),
        "Proposal id does not match: expected {}, got {:?}",
        expected.external_id,
        proposal.external_id.clone().take()
    );

    assert_eq!(
        proposal.name.clone().take(),
        Some(expected.name.to_string()),
        "Proposal name does not match: expected {}, got {:?}",
        expected.name,
        proposal.name.clone().take()
    );

    if let Some(body) = proposal.body.clone().take() {
        for expected_body in &expected.body_contains {
            assert!(
                body.contains(expected_body),
                "Proposal body does not contain expected text: expected to find {}, got {}",
                expected_body,
                body
            );
        }
    }

    assert_eq!(
        proposal.url.clone().take(),
        Some(expected.url.to_string()),
        "Proposal URL does not match: expected {}, got {:?}",
        expected.url,
        proposal.url.clone().take()
    );

    assert_eq!(
        proposal.discussion_url.clone().take(),
        Some(expected.discussion_url.to_string()),
        "Discussion URL does not match: expected {}, got {:?}",
        expected.discussion_url,
        proposal.discussion_url.clone().take()
    );

    if let Some(choices) = proposal.choices.clone().take() {
        let choices_json = choices.to_string();
        assert_eq!(
            choices_json, expected.choices,
            "Choices do not match: expected {}, got {}",
            expected.choices, choices_json
        );
    }

    if let Some(scores) = proposal.scores.clone().take() {
        let scores_json = scores.to_string();
        assert_eq!(
            scores_json, expected.scores,
            "Scores do not match: expected {}, got {}",
            expected.scores, scores_json
        );
    }

    assert_eq!(
        proposal.scores_total.clone().take(),
        Some(expected.scores_total),
        "Scores total does not match: expected {}, got {:?}",
        expected.scores_total,
        proposal.scores_total.clone().take()
    );

    assert_eq!(
        proposal.quorum.clone().take(),
        Some(expected.quorum),
        "Quorum does not match: expected {}, got {:?}",
        expected.quorum,
        proposal.quorum.clone().take()
    );

    assert_eq!(
        proposal.scores_quorum.clone().take(),
        Some(expected.scores_quorum),
        "Scores quorum does not match: expected {}, got {:?}",
        expected.scores_quorum,
        proposal.scores_quorum.clone().take()
    );

    assert_eq!(
        proposal.proposal_state.clone().take(),
        Some(expected.proposal_state.clone()),
        "Proposal state does not match: expected {:?}, got {:?}",
        expected.proposal_state,
        proposal.proposal_state.clone().take()
    );

    assert_eq!(
        proposal.flagged_spam.clone().take(),
        expected.flagged_spam,
        "Flagged spam does not match: expected {:?}, got {:?}",
        expected.flagged_spam,
        proposal.flagged_spam.clone().take()
    );

    if let Some(block_created) = proposal.block_created.clone().take() {
        assert_eq!(
            block_created, expected.block_created,
            "Block created does not match: expected {:?}, got {:?}",
            expected.block_created, block_created
        );
    }

    if let Some(time_created_str) = expected.time_created {
        let expected_time_created =
            NaiveDateTime::parse_from_str(time_created_str, "%Y-%m-%d %H:%M:%S").unwrap();
        assert_eq!(
            proposal.time_created.clone().take().unwrap(),
            expected_time_created,
            "Time created does not match: expected {:?}, got {:?}",
            expected_time_created,
            proposal.time_created.clone().take().unwrap()
        );
    }

    let expected_time_start =
        NaiveDateTime::parse_from_str(expected.time_start, "%Y-%m-%d %H:%M:%S").unwrap();
    assert_eq!(
        proposal.time_start.clone().take().unwrap(),
        expected_time_start,
        "Time start does not match: expected {:?}, got {:?}",
        expected_time_start,
        proposal.time_start.clone().take().unwrap()
    );

    let expected_time_end =
        NaiveDateTime::parse_from_str(expected.time_end, "%Y-%m-%d %H:%M:%S").unwrap();
    assert_eq!(
        proposal.time_end.clone().take().unwrap(),
        expected_time_end,
        "Time end does not match: expected {:?}, got {:?}",
        expected_time_end,
        proposal.time_end.clone().take().unwrap()
    );

    assert_eq!(
        proposal.votes_fetched.clone().take(),
        expected.votes_fetched,
        "Votes fetched does not match: expected {:?}, got {:?}",
        expected.votes_fetched,
        proposal.votes_fetched.clone().take()
    );

    assert_eq!(
        proposal.votes_refresh_speed.clone().take(),
        expected.votes_refresh_speed,
        "Votes refresh speed does not match: expected {:?}, got {:?}",
        expected.votes_refresh_speed,
        proposal.votes_refresh_speed.clone().take()
    );

    assert_eq!(
        proposal.votes_index.clone().take(),
        expected.votes_index,
        "Votes index does not match: expected {:?}, got {:?}",
        expected.votes_index,
        proposal.votes_index.clone().take()
    );

    assert_eq!(
        proposal.dao_id.clone().take(),
        Some(dao_id),
        "DAO ID does not match: expected {}, got {:?}",
        dao_id,
        proposal.dao_id.clone().take()
    );

    if let Some(metadata) = proposal.metadata.clone().take() {
        assert_eq!(
            metadata, expected.metadata,
            "Metadata do not match: expected {:?}, got {:?}",
            expected.metadata, metadata
        );
    }
}

pub struct ExpectedVote {
    pub voter_address: &'static str,
    pub voting_power: f64,
    pub block_created: Option<i32>,
    pub choice: Value,
    pub proposal_external_id: &'static str,
    pub reason: Option<String>,
}

pub fn assert_vote(vote: &vote::ActiveModel, expected: &ExpectedVote) {
    assert_eq!(
        vote.voter_address.clone().take().unwrap(),
        expected.voter_address,
        "Voter address mismatch: expected {}, got {}",
        expected.voter_address,
        vote.voter_address.clone().take().unwrap()
    );
    assert_eq!(
        vote.voting_power.clone().take().unwrap(),
        expected.voting_power,
        "Voting power mismatch: expected {}, got {}",
        expected.voting_power,
        vote.voting_power.clone().take().unwrap()
    );
    assert_eq!(
        vote.block_created.clone().take().unwrap(),
        expected.block_created,
        "Block created mismatch: expected {:?}, got {:?}",
        expected.block_created,
        vote.block_created.clone().take().unwrap()
    );

    let choices_json = vote.choice.clone().take().unwrap();
    assert_eq!(
        choices_json, expected.choice,
        "Choice do not match: expected {}, got {}",
        expected.choice, choices_json
    );

    assert_eq!(
        vote.reason.clone().take().unwrap(),
        expected.reason,
        "Reason mismatch: expected {:?}, got {:?}",
        expected.reason,
        vote.reason.clone().take().unwrap()
    );
    assert_eq!(
        vote.proposal_external_id.clone().take().unwrap(),
        expected.proposal_external_id,
        "Proposal external ID mismatch: expected {}, got {}",
        expected.proposal_external_id,
        vote.proposal_external_id.clone().take().unwrap()
    );
}
