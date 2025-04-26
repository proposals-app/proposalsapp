use crate::extensions::db_extension::DB;
use anyhow::{Context, Result};
use chrono::Utc;
use proposalsapp_db_indexer::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::collections::HashMap;
use tokio::time;
use tracing::{debug, error, info, instrument, warn};

#[instrument(name = "tasks_update_ended_proposals_state", skip_all)]
pub async fn update_ended_proposals_state() -> Result<()> {
    info!("Running task to update ended on-chain proposals state.");
    let db: &DatabaseConnection = DB.get().context("DB not initialized")?;

    let active_proposals = proposal::Entity::find()
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .all(db)
        .await?;

    if active_proposals.is_empty() {
        info!("No active proposals to check for end time.");
        return Ok(());
    }

    info!(
        proposal_count = active_proposals.len(),
        "Checking active proposals for end time."
    );

    for proposal in active_proposals {
        if proposal.end_at <= Utc::now().naive_utc() {
            info!(
                proposal_id = proposal.external_id,
                proposal_name = proposal.name,
                proposal_end_at = ?proposal.end_at,
                "Proposal end time reached. Calculating final state."
            );

            let votes = vote::Entity::find()
                .filter(vote::Column::ProposalId.eq(proposal.id))
                .all(db)
                .await?;

            let final_state = calculate_final_proposal_state(&proposal, &votes).await?;

            let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
            proposal_active_model.proposal_state = Set(final_state.clone());
            proposal::Entity::update(proposal_active_model)
                .exec(db)
                .await?;

            info!(
                proposal_id = proposal.external_id,
                proposal_name = proposal.name,
                final_state = ?final_state,
                "Proposal state updated to final state."
            );
        } else {
            debug!(
                proposal_id = proposal.external_id,
                proposal_name = proposal.name,
                proposal_end_at = ?proposal.end_at,
                current_time = ?Utc::now().naive_utc(),
                "Proposal end time not yet reached."
            );
        }
    }

    info!("Task to update ended proposals state completed.");
    Ok(())
}

#[instrument(name = "tasks_calculate_final_proposal_state", skip(proposal, votes), fields(proposal_id = proposal.external_id))]
/// Calculates the final state of a proposal based on votes and quorum, considering configured
/// quorum choices.
async fn calculate_final_proposal_state(proposal: &proposal::Model, votes: &Vec<vote::Model>) -> Result<ProposalState> {
    let mut for_votes = 0.0;
    let mut against_votes = 0.0;

    let choices_value = proposal.choices.clone();
    let choices_vec: Vec<String> = serde_json::from_value(choices_value.clone()).unwrap_or_else(|_| vec![]);

    let mut choice_map: HashMap<usize, String> = HashMap::new();
    for (index, choice_text) in choices_vec.iter().enumerate() {
        let lower_choice = choice_text.to_lowercase();
        if lower_choice.contains("for") {
            choice_map.insert(index, "for".to_string());
        } else if lower_choice.contains("against") {
            choice_map.insert(index, "against".to_string());
        } else if lower_choice.contains("abstain") {
            choice_map.insert(index, "abstain".to_string());
        } else {
            choice_map.insert(index, "unknown".to_string()); // Default case
        }
    }

    for vote in votes {
        match vote.choice.as_u64() {
            Some(choice_index) => match choice_map.get(&(choice_index as usize)).map(|s| s.as_str()) {
                Some("for") => for_votes += vote.voting_power,
                Some("against") => against_votes += vote.voting_power,
                Some(_) | None => {
                    warn!(
                        proposal_id = proposal.external_id,
                        choice_index = choice_index,
                        "Unknown choice type at index for proposal"
                    );
                }
            },
            None => {
                error!(
                    proposal_id = proposal.external_id,
                    "Vote choice is not a valid u64 for proposal"
                );
            }
        }
    }
    debug!(
        proposal_id = proposal.external_id,
        for_votes = for_votes,
        against_votes = against_votes,
        "Vote counts aggregated."
    );

    let mut quorum_votes = 0.0;
    let metadata_value = proposal.metadata.clone();
    let metadata = metadata_value.unwrap_or_default();

    let quorum_choices_value = metadata.get("quorum_choices");
    let quorum_choices_indexes: Vec<usize> = match quorum_choices_value {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_u64().map(|u| u as usize))
            .collect(),
        _ => {
            warn!(
                proposal_id = proposal.external_id,
                "quorum_choices not found or not an array in metadata, defaulting to [0, 1] (For and Against)."
            );
            vec![0, 1] // Default to For and Against if not configured
        }
    };

    for vote in votes.iter().filter(|vote| {
        vote.choice.as_u64().is_some_and(|choice_index| {
            quorum_choices_indexes.contains(&(choice_index as usize))
        })
    }) {
        quorum_votes += vote.voting_power;
    }

    let quorum = proposal.quorum;
    debug!(
        proposal_id = proposal.external_id,
        quorum_votes = quorum_votes,
        required_quorum = quorum,
        "Quorum votes calculated."
    );

    if quorum_votes >= quorum && for_votes > against_votes {
        info!(
            proposal_id = proposal.external_id,
            for_votes = for_votes,
            against_votes = against_votes,
            quorum_votes = quorum_votes,
            required_quorum = quorum,
            "Proposal Succeeded: For votes exceed against votes and quorum is met."
        );
        Ok(ProposalState::Succeeded)
    } else {
        info!(
            proposal_id = proposal.external_id,
            for_votes = for_votes,
            against_votes = against_votes,
            quorum_votes = quorum_votes,
            required_quorum = quorum,
            "Proposal Defeated: For votes did not exceed against votes or quorum not met."
        );
        Ok(ProposalState::Defeated)
    }
}

#[instrument(name = "tasks_run_periodic_proposal_state_update", skip_all)]
pub async fn run_periodic_proposal_state_update() -> Result<()> {
    info!("Starting periodic task for proposal state updates.");
    let mut interval = time::interval(time::Duration::from_secs(60));

    loop {
        interval.tick().await;
        match update_ended_proposals_state().await {
            Ok(_) => {
                info!("Successfully updated ended proposals state in periodic task.");
            }
            Err(e) => {
                error!(
                    error = %e,
                    "Failed to update ended proposals state in periodic task"
                );
            }
        }
    }
}
