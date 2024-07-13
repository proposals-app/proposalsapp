// src/test_utils.rs
use chrono::NaiveDateTime;
use sea_orm::prelude::Uuid;
use seaorm::{proposal, sea_orm_active_enums::ProposalStateEnum};

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
        "Proposal id does not match"
    );
    assert_eq!(
        proposal.name.clone().take().unwrap(),
        expected.name,
        "Proposal name does not match"
    );

    for body in &expected.body_contains {
        assert!(
            proposal.body.clone().take().unwrap().contains(body),
            "Proposal body does not match"
        );
    }

    assert!(
        proposal.scores_total.clone().take().unwrap() >= 0.0,
        "Invalid scores total"
    );
    assert_eq!(
        proposal.quorum.clone().take().unwrap(),
        expected.quorum,
        "Invalid quorum"
    );
    assert_eq!(
        proposal.url.clone().take().unwrap(),
        expected.url,
        "Proposal URL does not match"
    );
    assert_eq!(
        proposal.discussion_url.clone().take().unwrap(),
        expected.discussion_url,
        "Discussion URL does not match"
    );

    let choices_json = proposal.choices.clone().take().unwrap().to_string();
    assert_eq!(choices_json, expected.choices, "Choices do not match");

    let scores_json = proposal.scores.clone().take().unwrap().to_string();
    assert_eq!(scores_json, expected.scores, "Scores do not match");

    assert_eq!(
        proposal.scores_total.clone().take().unwrap(),
        expected.scores_total,
        "Scores total does not match"
    );
    assert_eq!(
        proposal.proposal_state.clone().take().unwrap(),
        expected.proposal_state,
        "Proposal state does not match"
    );
    assert_eq!(
        proposal.block_created.clone().take().unwrap(),
        expected.block_created,
        "Block created does not match"
    );

    if let Some(time_created_str) = expected.time_created {
        let expected_time_created =
            NaiveDateTime::parse_from_str(time_created_str, "%Y-%m-%d %H:%M:%S").unwrap();
        assert_eq!(
            proposal.time_created.clone().take().unwrap(),
            Some(expected_time_created),
            "Time created does not match"
        );
    }

    let expected_time_start =
        NaiveDateTime::parse_from_str(expected.time_start, "%Y-%m-%d %H:%M:%S").unwrap();
    assert_eq!(
        proposal.time_start.clone().take().unwrap(),
        expected_time_start,
        "Time start does not match"
    );

    let expected_time_end =
        NaiveDateTime::parse_from_str(expected.time_end, "%Y-%m-%d %H:%M:%S").unwrap();
    assert_eq!(
        proposal.time_end.clone().take().unwrap(),
        expected_time_end,
        "Time end does not match"
    );

    assert_eq!(
        proposal.dao_handler_id.clone().take().unwrap(),
        dao_handler_id,
        "DAO handler ID does not match"
    );

    assert_eq!(
        proposal.dao_id.clone().take().unwrap(),
        dao_id,
        "DAO ID does not match"
    );
}
