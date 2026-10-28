//! Keeps on-chain proposal states moving after ProposalCreated.
//!
//! ProposalCreated handlers store whatever `state()` returns at indexing time. A proposal
//! indexed live is still PENDING then (voting starts after the voting delay), and no event
//! marks the start of voting or a defeat, so the periodic task has to advance these states.

use crate::extensions::db_extension::DB;
use alloy::primitives::U256;
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState};
use sea_orm::{ActiveValue::Set, ColumnTrait, Condition, EntityTrait, QueryFilter, prelude::Uuid};
use std::future::Future;
use tracing::{error, info, warn};

/// Map an OpenZeppelin Governor / GovernorBravo `ProposalState` enum value.
/// Both use the same ordering.
pub fn proposal_state_from_governor_code(code: u8) -> ProposalState {
    match code {
        0 => ProposalState::Pending,
        1 => ProposalState::Active,
        2 => ProposalState::Canceled,
        3 => ProposalState::Defeated,
        4 => ProposalState::Succeeded,
        5 => ProposalState::Queued,
        6 => ProposalState::Expired,
        7 => ProposalState::Executed,
        _ => ProposalState::Unknown,
    }
}

/// What to do with a proposal whose state may have changed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateRefresh {
    /// Leave the stored state alone.
    Keep,
    /// Store this state.
    Set(ProposalState),
    /// Voting has ended but the chain could not be asked: derive the result from the
    /// indexed votes.
    ComputeFromVotes,
}

/// Decide the next state for a PENDING/ACTIVE proposal.
///
/// `on_chain` is the governor's `state()` for the proposal, or `None` if the call
/// failed. The chain is authoritative; without it, fall back to the stored voting window.
pub fn next_proposal_state(
    current: &ProposalState,
    start_at: NaiveDateTime,
    end_at: NaiveDateTime,
    now: NaiveDateTime,
    on_chain: Option<ProposalState>,
) -> StateRefresh {
    match on_chain {
        Some(ProposalState::Unknown) | None => {
            if end_at <= now {
                StateRefresh::ComputeFromVotes
            } else if *current == ProposalState::Pending && start_at <= now {
                StateRefresh::Set(ProposalState::Active)
            } else {
                StateRefresh::Keep
            }
        }
        Some(state) if state == *current => StateRefresh::Keep,
        Some(state) => StateRefresh::Set(state),
    }
}

/// PENDING proposals whose voting should have started and ACTIVE proposals whose voting
/// should have ended. Those are the only points where the state changes without an
/// indexed event (other than cancellation).
pub async fn proposals_due_for_state_refresh(
    governor_id: Uuid,
    now: NaiveDateTime,
) -> Result<Vec<proposal::Model>> {
    let db = DB.get().context("DB not initialized")?;

    proposal::Entity::find()
        .filter(proposal::Column::GovernorId.eq(governor_id))
        .filter(
            Condition::any()
                .add(
                    Condition::all()
                        .add(proposal::Column::ProposalState.eq(ProposalState::Pending))
                        .add(proposal::Column::StartAt.lte(now)),
                )
                .add(
                    Condition::all()
                        .add(proposal::Column::ProposalState.eq(ProposalState::Active))
                        .add(proposal::Column::EndAt.lte(now)),
                ),
        )
        .all(db)
        .await
        .context("Failed to fetch proposals due for a state refresh")
}

/// Advance the state of a governor's PENDING/ACTIVE proposals.
///
/// `fetch_state` reads `state(proposalId)` from the governor contract;
/// `final_state_from_votes` derives the result from indexed votes and is only used when
/// voting has ended and the chain could not be asked.
pub async fn refresh_governor_proposal_states<S, SF, V, VF>(
    governor: &str,
    governor_id: Uuid,
    fetch_state: S,
    final_state_from_votes: V,
) -> Result<()>
where
    S: Fn(U256) -> SF,
    SF: Future<Output = Result<u8>>,
    V: Fn(proposal::Model) -> VF,
    VF: Future<Output = Result<ProposalState>>,
{
    let db = DB.get().context("DB not initialized")?;
    let now = chrono::Utc::now().naive_utc();
    let proposals = proposals_due_for_state_refresh(governor_id, now).await?;

    if proposals.is_empty() {
        info!(
            governor,
            "No pending or active proposals due for a state refresh"
        );
        return Ok(());
    }

    info!(
        governor,
        proposal_count = proposals.len(),
        "Refreshing proposal states"
    );

    for proposal in proposals {
        let on_chain = match proposal.external_id.parse::<U256>() {
            Ok(proposal_id) => match fetch_state(proposal_id).await {
                Ok(code) => Some(proposal_state_from_governor_code(code)),
                Err(e) => {
                    warn!(
                        governor,
                        proposal_id = proposal.external_id,
                        error = %e,
                        "Failed to fetch on-chain proposal state, falling back to the voting window"
                    );
                    None
                }
            },
            Err(e) => {
                error!(
                    governor,
                    proposal_id = proposal.external_id,
                    error = %e,
                    "Proposal external_id is not a uint256"
                );
                None
            }
        };

        let new_state = match next_proposal_state(
            &proposal.proposal_state,
            proposal.start_at,
            proposal.end_at,
            now,
            on_chain,
        ) {
            StateRefresh::Keep => continue,
            StateRefresh::Set(state) => state,
            StateRefresh::ComputeFromVotes => final_state_from_votes(proposal.clone()).await?,
        };

        if new_state == proposal.proposal_state {
            continue;
        }

        proposal::Entity::update(proposal::ActiveModel {
            id: Set(proposal.id),
            proposal_state: Set(new_state.clone()),
            ..Default::default()
        })
        .exec(db)
        .await
        .context("Failed to update proposal state")?;

        info!(
            governor,
            proposal_id = proposal.external_id,
            proposal_name = proposal.name,
            previous_state = ?proposal.proposal_state,
            new_state = ?new_state,
            "Proposal state updated"
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn at(day: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 7, day)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap()
    }

    #[test]
    fn maps_governor_codes() {
        assert_eq!(proposal_state_from_governor_code(0), ProposalState::Pending);
        assert_eq!(proposal_state_from_governor_code(1), ProposalState::Active);
        assert_eq!(
            proposal_state_from_governor_code(3),
            ProposalState::Defeated
        );
        assert_eq!(
            proposal_state_from_governor_code(7),
            ProposalState::Executed
        );
        assert_eq!(proposal_state_from_governor_code(8), ProposalState::Unknown);
    }

    #[test]
    fn chain_state_wins() {
        // Stuck PENDING long after voting ended: take the chain's final state.
        assert_eq!(
            next_proposal_state(
                &ProposalState::Pending,
                at(1),
                at(15),
                at(30),
                Some(ProposalState::Executed)
            ),
            StateRefresh::Set(ProposalState::Executed)
        );
        // Voting started.
        assert_eq!(
            next_proposal_state(
                &ProposalState::Pending,
                at(1),
                at(15),
                at(2),
                Some(ProposalState::Active)
            ),
            StateRefresh::Set(ProposalState::Active)
        );
        // Estimated start passed but the chain says not yet.
        assert_eq!(
            next_proposal_state(
                &ProposalState::Pending,
                at(1),
                at(15),
                at(2),
                Some(ProposalState::Pending)
            ),
            StateRefresh::Keep
        );
        // Estimated end passed but voting is still open (e.g. extended).
        assert_eq!(
            next_proposal_state(
                &ProposalState::Active,
                at(1),
                at(15),
                at(16),
                Some(ProposalState::Active)
            ),
            StateRefresh::Keep
        );
    }

    #[test]
    fn falls_back_to_voting_window_without_chain_state() {
        assert_eq!(
            next_proposal_state(&ProposalState::Pending, at(1), at(15), at(2), None),
            StateRefresh::Set(ProposalState::Active)
        );
        assert_eq!(
            next_proposal_state(&ProposalState::Pending, at(1), at(15), at(20), None),
            StateRefresh::ComputeFromVotes
        );
        assert_eq!(
            next_proposal_state(
                &ProposalState::Active,
                at(1),
                at(15),
                at(20),
                Some(ProposalState::Unknown)
            ),
            StateRefresh::ComputeFromVotes
        );
        assert_eq!(
            next_proposal_state(&ProposalState::Active, at(1), at(15), at(2), None),
            StateRefresh::Keep
        );
    }
}
