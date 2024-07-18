use chrono::NaiveDateTime;
use sea_orm::prelude::Uuid;
use seaorm::{proposal, sea_orm_active_enums::ProposalStateEnum, vote};

pub struct ExpectedProposal {
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
    pub proposal_state: ProposalStateEnum,
    pub block_created: Option<i32>,
    pub time_created: Option<&'static str>,
    pub time_start: &'static str,
    pub time_end: &'static str,
}

pub fn assert_proposal(
    proposal: &proposal::ActiveModel,
    expected: &ExpectedProposal,
    dao_handler_id: Uuid,
    dao_id: Uuid,
) {
    assert_eq!(
        proposal.external_id.clone().take().unwrap(),
        expected.external_id,
        "Proposal id does not match: expected {}, got {}",
        expected.external_id,
        proposal.external_id.clone().take().unwrap()
    );
    assert_eq!(
        proposal.name.clone().take().unwrap(),
        expected.name,
        "Proposal name does not match: expected {}, got {}",
        expected.name,
        proposal.name.clone().take().unwrap()
    );

    for body in &expected.body_contains {
        assert!(
            proposal.body.clone().take().unwrap().contains(body),
            "Proposal body does not contain expected text: expected to find {}, got {}",
            body,
            proposal.body.clone().take().unwrap()
        );
    }

    assert_eq!(
        proposal.url.clone().take().unwrap(),
        expected.url,
        "Proposal URL does not match: expected {}, got {}",
        expected.url,
        proposal.url.clone().take().unwrap()
    );
    assert_eq!(
        proposal.discussion_url.clone().take().unwrap(),
        expected.discussion_url,
        "Discussion URL does not match: expected {}, got {}",
        expected.discussion_url,
        proposal.discussion_url.clone().take().unwrap()
    );

    let choices_json = proposal.choices.clone().take().unwrap().to_string();
    assert_eq!(
        choices_json, expected.choices,
        "Choices do not match: expected {}, got {}",
        expected.choices, choices_json
    );

    let scores_json = proposal.scores.clone().take().unwrap().to_string();
    assert_eq!(
        scores_json, expected.scores,
        "Scores do not match: expected {}, got {}",
        expected.scores, scores_json
    );

    assert_eq!(
        proposal.scores_total.clone().take().unwrap(),
        expected.scores_total,
        "Scores total does not match: expected {}, got {}",
        expected.scores_total,
        proposal.scores_total.clone().take().unwrap()
    );

    assert_eq!(
        proposal.quorum.clone().take().unwrap(),
        expected.quorum,
        "Quorum does not match: expected {}, got {}",
        expected.quorum,
        proposal.quorum.clone().take().unwrap()
    );

    assert_eq!(
        proposal.scores_quorum.clone().take().unwrap(),
        expected.scores_quorum,
        "Scores quorum does not match: expected {}, got {}",
        expected.scores_quorum,
        proposal.scores_quorum.clone().take().unwrap()
    );

    assert_eq!(
        proposal.proposal_state.clone().take().unwrap(),
        expected.proposal_state,
        "Proposal state does not match: expected {:?}, got {:?}",
        expected.proposal_state,
        proposal.proposal_state.clone().take().unwrap()
    );
    assert_eq!(
        proposal.block_created.clone().take().unwrap(),
        expected.block_created,
        "Block created does not match: expected {:?}, got {:?}",
        expected.block_created,
        proposal.block_created.clone().take().unwrap()
    );

    if let Some(time_created_str) = expected.time_created {
        let expected_time_created =
            NaiveDateTime::parse_from_str(time_created_str, "%Y-%m-%d %H:%M:%S").unwrap();
        assert_eq!(
            proposal.time_created.clone().take().unwrap(),
            Some(expected_time_created),
            "Time created does not match: expected {:?}, got {:?}",
            Some(expected_time_created),
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
        proposal.dao_handler_id.clone().take().unwrap(),
        dao_handler_id,
        "DAO handler ID does not match: expected {}, got {}",
        dao_handler_id,
        proposal.dao_handler_id.clone().take().unwrap()
    );

    assert_eq!(
        proposal.dao_id.clone().take().unwrap(),
        dao_id,
        "DAO ID does not match: expected {}, got {}",
        dao_id,
        proposal.dao_id.clone().take().unwrap()
    );
}

pub struct ExpectedVote {
    pub voter_address: &'static str,
    pub voting_power: f64,
    pub block_created: Option<i32>,
    pub choice: i32,
    pub proposal_external_id: &'static str,
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
    assert_eq!(
        vote.choice.clone().take().unwrap(),
        expected.choice,
        "Choice mismatch: expected {}, got {}",
        expected.choice,
        vote.choice.clone().take().unwrap()
    );
    assert_eq!(
        vote.proposal_external_id.clone().take().unwrap(),
        expected.proposal_external_id,
        "Proposal external ID mismatch: expected {}, got {}",
        expected.proposal_external_id,
        vote.proposal_external_id.clone().take().unwrap()
    );
}
