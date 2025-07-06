#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_treasury_governor::{
    ArbitrumTreasuryGovernorEventType, ProposalCreatedEvent, ProposalExecutedEvent,
    ProposalExtendedEvent, VoteCastEvent, no_extensions,
};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{
            DAO_SLUG_GOVERNOR_TYPE_ID_MAP, DAO_SLUG_ID_MAP, DB, store_proposal, store_votes,
        },
    },
    rindexer_lib::typings::rindexer::events::arbitrum_treasury_governor::arbitrum_treasury_governor_contract,
};
use alloy::{hex::ToHexExt, primitives::U256};
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use futures::{StreamExt, stream};
use proposalsapp_db::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use rindexer::{
    EthereumSqlTypeWrapper, PgType, RindexerColorize,
    event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus,
    rindexer_error,
};
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{self, NotSet},
    ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QuerySelect, Set,
    prelude::Uuid,
};
use serde_json::json;
use std::{collections::HashMap, path::PathBuf, sync::Arc};
use tracing::{debug, error, info, instrument};

fn get_governor_id() -> Option<Uuid> {
    DAO_SLUG_GOVERNOR_TYPE_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .unwrap()
        .get("ARBITRUM_TREASURY")
        .copied()
}

fn get_dao_id() -> Option<Uuid> {
    DAO_SLUG_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .copied()
}

const CONCURRENCY_LIMIT: usize = 100;

#[instrument(
    name = "arbitrum_treasury_governor_proposal_created_handler",
    skip(manifest_path, registry)
)]
async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor ProposalCreated events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::ProposalCreated events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
                    let block_number = result.tx_information.block_number.to::<u64>();
                    let arbitrum_treasury_governor = arbitrum_treasury_governor_contract("arbitrum-ethcall").await;

                    let created_at = match estimate_timestamp("arbitrum", block_number).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, block_number = block_number, error = %e, "Failed to estimate created_at timestamp");
                            continue; // Skip proposal if timestamp estimation fails
                        }
                    };

                    let start_at = match estimate_timestamp("ethereum", result.event_data.startBlock.to::<u64>()).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, block_number = block_number, error = %e, start_block = %result.event_data.startBlock, "Failed to estimate start_at timestamp");
                            continue;
                        }
                    };

                    let end_at = match estimate_timestamp("ethereum", result.event_data.endBlock.to::<u64>()).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, block_number = block_number, error = %e, end_block = %result.event_data.endBlock, "Failed to estimate end_at timestamp");
                            continue;
                        }
                    };

                    let title = extract_title(&result.event_data.description);
                    let proposal_url = format!(
                        "https://www.tally.xyz/gov/arbitrum/proposal/{proposal_id}"
                    );
                    let choices = vec!["For", "Against", "Abstain"];

                    let proposal_state_result = arbitrum_treasury_governor.state(proposal_id).call().await;
                    let proposal_state = match proposal_state_result {
                        Ok(state_enum) => match state_enum {
                            0 => ProposalState::Pending,
                            1 => ProposalState::Active,
                            2 => ProposalState::Canceled,
                            3 => ProposalState::Defeated,
                            4 => ProposalState::Succeeded,
                            5 => ProposalState::Queued,
                            6 => ProposalState::Expired,
                            7 => ProposalState::Executed,
                            _ => ProposalState::Unknown,
                        },
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to fetch proposal state from contract, defaulting to Unknown");
                            ProposalState::Unknown
                        }
                    };

                    let proposal_snapshot_block_result = arbitrum_treasury_governor
                        .proposalSnapshot(proposal_id)
                        .call()
                        .await;
                    let quorum_result = match proposal_snapshot_block_result {
                        Ok(snapshot_block) => {
                            arbitrum_treasury_governor
                                .quorum(snapshot_block)
                                .call()
                                .await
                        }
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to fetch proposal snapshot block, defaulting quorum to 0");
                            Err(e)
                        }
                    };

                    let quorum = match quorum_result {
                        Ok(r) => r.to::<u128>() as f64 / (10.0f64.powi(18)),
                        Err(_) => U256::from(0).to::<u128>() as f64 / (10.0f64.powi(18)),
                    };

                    let total_delegated_vp = match calculate_total_delegated_vp(created_at).await {
                        Ok(vp) => vp,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, "Failed to calculate total delegated voting power");
                            0.0 // Default to 0 if calculation fails
                        }
                    };

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: Set(title),
                        body: Set(result.event_data.description.clone()),
                        url: Set(proposal_url),
                        discussion_url: NotSet,
                        choices: Set(json!(choices)),
                        quorum: Set(quorum),
                        proposal_state: Set(proposal_state),
                        marked_spam: NotSet,
                        created_at: Set(created_at),
                        start_at: Set(start_at),
                        end_at: Set(end_at),
                        block_created_at: Set(Some(block_number as i32)),
                        block_start_at: Set(Some(result.event_data.startBlock.to::<u64>() as i32)),
                        block_end_at: Set(Some(result.event_data.endBlock.to::<u64>() as i32)),
                        metadata: Set(json!({"vote_type":"basic", "quorum_choices":[0,2], "total_delegated_vp":total_delegated_vp, "targets":result.event_data.targets, "values":result.event_data.values, "calldatas":result.event_data.calldatas, "signatures":result.event_data.signatures}).into()),
                        txid: Set(Some(result.tx_information.transaction_hash.to_string())),
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: Set(Some(result.event_data.proposer.to_string())),
                    };

                    if let Err(e) = store_proposal(proposal).await {
                        error!(proposal_id = %proposal_id, error = %e, "Failed to store proposal");
                    } else {
                        debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, "ArbitrumTreasuryGovernor Proposal stored");
                    }
                }

                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalCreated",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::ProposalCreated events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(
    name = "arbitrum_treasury_governor_proposal_executed_handler",
    skip(manifest_path, registry)
)]
async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor ProposalExecuted events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::ProposalExecuted events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        quorum: NotSet,
                        proposal_state: Set(ProposalState::Executed),
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: NotSet,
                        block_created_at: NotSet,
                        block_start_at: NotSet,
                        block_end_at: NotSet,
                        metadata: NotSet,
                        txid: NotSet,
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: NotSet,
                    };

                    if let Err(e) = store_proposal(proposal).await {
                        error!(proposal_id = %proposal_id, error = %e, "Failed to update proposal state to Executed");
                    } else {
                        debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, "ArbitrumTreasuryGovernor Proposal state updated to Executed");
                    }
                }

                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExecuted",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::ProposalExecuted events processed and indexed"
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(
    name = "arbitrum_treasury_governor_proposal_extended_handler",
    skip(manifest_path, registry)
)]
async fn proposal_extended_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalExtended(
        ProposalExtendedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor ProposalExtended events to process in this batch.");
                    return Ok(());
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExtended",
                    event_count = results.len(),
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::ProposalExtended events"
                );

                for result in results.clone() {
                    let proposal_id = result.event_data.proposalId;
                    let extended_deadline = result.event_data.extendedDeadline;

                    let end_at = match estimate_timestamp("ethereum", extended_deadline).await {
                        Ok(ts) => ts,
                        Err(e) => {
                            error!(proposal_id = %proposal_id, error = %e, extended_deadline = %extended_deadline, "Failed to estimate end_at timestamp for ProposalExtended event");
                            continue; // Skip proposal update if timestamp estimation fails
                        }
                    };

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        quorum: NotSet,
                        proposal_state: NotSet,
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: Set(end_at),
                        block_created_at: NotSet,
                        block_start_at: NotSet,
                        block_end_at: NotSet,
                        metadata: NotSet,
                        txid: NotSet,
                        governor_id: Set(get_governor_id().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: NotSet,
                    };

                    if let Err(e) = store_proposal(proposal).await {
                        error!(proposal_id = %proposal_id, error = %e, "Failed to update proposal end_at for ProposalExtended event");
                    } else {
                        debug!(proposal_id = %proposal_id, external_id = %result.event_data.proposalId, end_at = ?end_at, "ArbitrumTreasuryGovernor Proposal end_at updated for ProposalExtended event");
                    }
                }
                info!(
                    event_name = "ArbitrumTreasuryGovernor::ProposalExtended",
                    event_count = results.len(),
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::ProposalExtended events processed and indexed"
                );
                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(
    name = "arbitrum_treasury_governor_vote_cast_handler",
    skip(manifest_path, registry)
)]
async fn vote_cast_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    debug!("No ArbitrumTreasuryGovernor VoteCast events to process in this batch.");
                    return Ok(());
                }

                let results_len = results.len();
                info!(
                    event_name = "ArbitrumTreasuryGovernor::VoteCast",
                    event_count = results_len,
                    status = "INDEXING",
                    "Processing ArbitrumTreasuryGovernor::VoteCast events"
                );

                let governor_id_for_votes = get_governor_id().unwrap();

                let votes: Vec<vote::ActiveModel> = stream::iter(results)
                    .map(|result| async move {
                        let block_number = result.tx_information.block_number.to::<u64>();
                        let proposal_id = result.event_data.proposalId.to_string();

                        let created_at = match estimate_timestamp("arbitrum", block_number).await {
                            Ok(ts) => ts,
                            Err(e) => {
                                error!(proposal_id = %proposal_id, block_number = block_number, error = %e, "Failed to estimate created_at timestamp for VoteCast event");
                                return None; // Skip vote if timestamp estimation fails
                            }
                        };

                        Some(vote::ActiveModel {
                            id: NotSet,
                            voter_address: Set(result.event_data.voter.to_string()),
                            choice: Set(match result.event_data.support {
                                0 => 1.into(),
                                1 => 0.into(),
                                2 => 2.into(),
                                _ => 2.into(),
                            }),
                            voting_power: Set((result.event_data.weight.to::<u128>() as f64) / (10.0f64.powi(18))),
                            reason: Set(Some(result.event_data.reason.clone())),
                            created_at: Set(created_at),
                            block_created_at: Set(Some(block_number as i32)),
                            txid: Set(Some(result.tx_information.transaction_hash.to_string())),
                            proposal_external_id: Set(proposal_id),
                            proposal_id: NotSet,
                            governor_id: Set(governor_id_for_votes),
                            dao_id: Set(get_dao_id().unwrap()),
                        })
                    })
                    .buffer_unordered(CONCURRENCY_LIMIT)
                    .filter_map(|vote_opt| async { vote_opt }) // Filter out None values
                    .collect::<Vec<_>>()
                    .await;

                if let Err(e) = store_votes(votes, governor_id_for_votes).await {
                    error!(error = %e, "Failed to store votes");
                }

                info!(
                    event_name = "ArbitrumTreasuryGovernor::VoteCast",
                    event_count = results_len,
                    status = "INDEXED",
                    "ArbitrumTreasuryGovernor::VoteCast events processed and indexed"
                );
                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry)
    .await;
}

#[instrument(
    name = "arbitrum_treasury_governor_handlers",
    skip(manifest_path, registry)
)]
pub async fn arbitrum_treasury_governor_handlers(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    proposal_created_handler(manifest_path, registry).await;
    proposal_executed_handler(manifest_path, registry).await;
    proposal_extended_handler(manifest_path, registry).await;
    vote_cast_handler(manifest_path, registry).await;
    info!("Arbitrum Treasury Governor handlers registered.");
}

fn extract_title(description: &str) -> String {
    // ... (same as in arbitrum_core_governor.rs)
    let mut lines = description
        .split('\n')
        .filter(|line| !line.trim().is_empty());

    // Try to find the first non-empty line that isn't just "#" markers
    let title = lines
        .find(|line| {
            let trimmed = line.trim_start_matches('#').trim();
            !trimmed.is_empty()
        })
        .unwrap_or("Unknown")
        .trim_start_matches('#')
        .trim()
        .to_string();

    // Truncate to 120 chars if needed
    if title.len() > 120 {
        title.chars().take(120).collect()
    } else {
        title
    }
}

#[instrument(
    name = "arbitrum_treasury_governor_update_active_proposals_end_time",
    skip_all
)]
pub async fn update_active_proposals_end_time() -> Result<()> {
    let db = DB.get().unwrap();

    // Get all active proposals for this governor
    let active_proposals = proposal::Entity::find()
        .filter(
            proposal::Column::GovernorId
                .eq(get_governor_id().context("Failed to get governor ID")?),
        )
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .all(db)
        .await
        .context("Failed to fetch active proposals")?;

    if active_proposals.is_empty() {
        return Ok(());
    }

    info!(
        governor = "ARBITRUM_TREASURY",
        active_proposals_count = active_proposals.len(),
        "Updating end times for active proposals"
    );

    for proposal in active_proposals {
        let proposal_id = proposal.external_id.clone();

        let block_start_at = match proposal.block_start_at {
            Some(block) => block as u64,
            None => {
                error!(proposal_id = %proposal_id, "Missing block_start_at for proposal");
                continue;
            }
        };

        let block_end_at = match proposal.block_end_at {
            Some(block) => block as u64,
            None => {
                error!(proposal_id = %proposal_id, "Missing block_end_at for proposal");
                continue;
            }
        };

        // Re-fetch the times on the block
        let new_start_at = match estimate_timestamp("ethereum", block_start_at).await {
            Ok(ts) => ts,
            Err(e) => {
                error!(proposal_id = %proposal_id, block_number = block_start_at, error = %e, "Failed to estimate new start_at timestamp");
                continue;
            }
        };
        let new_end_at = match estimate_timestamp("ethereum", block_end_at).await {
            Ok(ts) => ts,
            Err(e) => {
                error!(proposal_id = %proposal_id, block_number = block_end_at, error = %e, "Failed to estimate new end_at timestamp");
                continue;
            }
        };

        // Only update times changed
        if new_end_at != proposal.end_at || new_start_at != proposal.start_at {
            debug!(
                proposal_id = %proposal_id,
                old_end_at = ?proposal.end_at,
                new_end_at = ?new_end_at,
                old_start_at = ?proposal.start_at,
                new_start_at = ?new_start_at,
                "Updating proposal times"
            );

            // Update the proposal with the new times
            let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
            proposal_active_model.end_at = Set(new_end_at);
            proposal_active_model.start_at = Set(new_start_at);

            if let Err(e) = proposal_active_model.update(db).await {
                error!(proposal_id = %proposal_id, error = %e, "Failed to update proposal times");
            }
        }
    }

    info!(
        governor = "ARBITRUM_TREASURY",
        "Successfully updated end times for active proposals"
    );

    Ok(())
}

#[instrument(
    name = "arbitrum_treasury_governor_update_ended_proposals_state",
    skip_all
)]
pub async fn update_ended_proposals_state() -> Result<()> {
    info!(
        governor = "ARBITRUM_TREASURY",
        "Running task to update ended proposal states"
    );
    let db = DB.get().context("DB not initialized")?;

    let active_proposals = proposal::Entity::find()
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .filter(proposal::Column::EndAt.lt(chrono::Utc::now().naive_utc()))
        .filter(
            proposal::Column::GovernorId
                .eq(get_governor_id().context("Failed to get governor ID")?),
        )
        .all(db)
        .await
        .context("Failed to fetch ended active proposals")?;

    if active_proposals.is_empty() {
        info!(
            governor = "ARBITRUM_TREASURY",
            "No active proposals have ended"
        );
        return Ok(());
    }

    info!(
        governor = "ARBITRUM_TREASURY",
        proposal_count = active_proposals.len(),
        "Processing ended proposals"
    );

    for proposal in active_proposals {
        info!(
            governor = "ARBITRUM_TREASURY",
            proposal_id = proposal.external_id,
            proposal_name = proposal.name,
            proposal_end_at = ?proposal.end_at,
            "Proposal end time reached. Calculating final state."
        );

        let votes = vote::Entity::find()
            .filter(vote::Column::ProposalId.eq(proposal.id))
            .all(db)
            .await
            .context("Failed to fetch votes for proposal")?;

        let final_state = calculate_final_proposal_state(&proposal, &votes).await?;

        let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
        proposal_active_model.proposal_state = Set(final_state.clone());
        proposal::Entity::update(proposal_active_model)
            .exec(db)
            .await
            .context("Failed to update proposal state")?;

        info!(
            governor = "ARBITRUM_TREASURY",
            proposal_id = proposal.external_id,
            proposal_name = proposal.name,
            final_state = ?final_state,
            "Proposal state updated to final state."
        );
    }

    info!(
        governor = "ARBITRUM_TREASURY",
        "Task to update ended proposals state completed."
    );
    Ok(())
}

#[instrument(name = "arbitrum_treasury_governor_calculate_final_proposal_state", skip(proposal, votes), fields(proposal_id = proposal.external_id))]
async fn calculate_final_proposal_state(
    proposal: &proposal::Model,
    votes: &Vec<vote::Model>,
) -> Result<ProposalState> {
    let mut for_votes = 0.0;
    let mut against_votes = 0.0;

    let choices_value = proposal.choices.clone();
    let choices_vec: Vec<String> =
        serde_json::from_value(choices_value.clone()).unwrap_or_else(|_| vec![]);

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
            Some(choice_index) => {
                match choice_map.get(&(choice_index as usize)).map(|s| s.as_str()) {
                    Some("for") => for_votes += vote.voting_power,
                    Some("against") => against_votes += vote.voting_power,
                    Some(_) | None => {
                        debug!(
                            proposal_id = proposal.external_id,
                            choice_index = choice_index,
                            "Unknown choice type at index for proposal"
                        );
                    }
                }
            }
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
            debug!(
                proposal_id = proposal.external_id,
                "quorum_choices not found or not an array in metadata, defaulting to [0, 1] (For and Against)."
            );
            vec![0, 1] // Default to For and Against if not configured
        }
    };

    for vote in votes.iter().filter(|vote| {
        vote.choice
            .as_u64()
            .is_some_and(|choice_index| quorum_choices_indexes.contains(&(choice_index as usize)))
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

#[instrument(name = "arbitrum_treasury_governor_calculate_total_delegated_vp", skip(timestamp), fields(timestamp = ?timestamp))]
async fn calculate_total_delegated_vp(timestamp: NaiveDateTime) -> Result<f64> {
    // ... (same as in arbitrum_core_governor.rs)
    use sea_orm::{DbBackend, Statement};

    let db = DB.get().unwrap();

    // Construct the raw SQL query
    let sql = r#"
        WITH latest_voting_power AS (
            SELECT
                voter,
                voting_power,
                ROW_NUMBER() OVER (
                    PARTITION BY voter
                    ORDER BY timestamp DESC, block DESC
                ) AS rn
            FROM voting_power
            WHERE
                voter != '0x00000000000000000000000000000000000A4B86'
                AND timestamp <= $1
        )
        SELECT COALESCE(SUM(voting_power), 0.0) as total_voting_power
        FROM latest_voting_power
        WHERE rn = 1
    "#;

    // Execute the raw SQL query
    let result = db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            sql,
            vec![timestamp.into()],
        ))
        .await
        .context("Failed to execute SQL query")?;

    // Extract the total voting power from the result
    let total_vp: f64 = result
        .map(|qr| qr.try_get::<f64>("", "total_voting_power"))
        .transpose()
        .context("Failed to get total_voting_power from query result")?
        .unwrap_or(0.0);

    debug!(total_voting_power = total_vp, timestamp = ?timestamp, "Total delegated voting power calculated");
    Ok(total_vp)
}

#[instrument(
    name = "arbitrum_treasury_governor_update_active_proposals_quorum",
    skip_all
)]
pub async fn update_active_proposals_quorum() -> Result<()> {
    let db = DB.get().unwrap();

    // Get all active proposals that have started for this governor
    let active_proposals = proposal::Entity::find()
        .filter(
            proposal::Column::GovernorId
                .eq(get_governor_id().context("Failed to get governor ID")?),
        )
        .filter(proposal::Column::ProposalState.eq(ProposalState::Active))
        .filter(proposal::Column::StartAt.lte(chrono::Utc::now().naive_utc()))
        .all(db)
        .await
        .context("Failed to fetch active and started proposals")?;

    if active_proposals.is_empty() {
        return Ok(());
    }

    info!(
        governor = "ARBITRUM_TREASURY",
        active_proposals_count = active_proposals.len(),
        "Updating quorum for active and started proposals"
    );

    let arbitrum_treasury_governor = arbitrum_treasury_governor_contract("arbitrum").await;

    for proposal in active_proposals {
        let proposal_id = proposal.external_id.clone();
        let proposal_id_u256: U256 = match proposal_id.parse() {
            Ok(id) => id,
            Err(e) => {
                error!(proposal_id = %proposal_id, error = %e, "Failed to parse proposal ID");
                continue;
            }
        };

        // Get the current quorum value from the contract
        let proposal_snapshot_block_result = arbitrum_treasury_governor
            .proposalSnapshot(proposal_id_u256)
            .call()
            .await;

        let current_quorum = match proposal_snapshot_block_result {
            Ok(snapshot_block) => {
                match arbitrum_treasury_governor
                    .quorum(snapshot_block)
                    .call()
                    .await
                {
                    Ok(quorum_value) => quorum_value.to::<u128>() as f64 / (10.0f64.powi(18)),
                    Err(e) => {
                        error!(proposal_id = %proposal_id, error = %e, "Failed to fetch current quorum from contract");
                        continue;
                    }
                }
            }
            Err(e) => {
                error!(proposal_id = %proposal_id, error = %e, "Failed to fetch proposal snapshot block");
                continue;
            }
        };

        // Only update if the quorum has changed
        if (current_quorum - proposal.quorum).abs() > f64::EPSILON {
            debug!(
                proposal_id = %proposal_id,
                old_quorum = proposal.quorum,
                new_quorum = current_quorum,
                "Updating proposal quorum"
            );

            // Update the proposal with the new quorum
            let mut proposal_active_model: proposal::ActiveModel = proposal.clone().into();
            proposal_active_model.quorum = Set(current_quorum);

            if let Err(e) = proposal_active_model.update(db).await {
                error!(proposal_id = %proposal_id, error = %e, "Failed to update proposal quorum");
            } else {
                debug!(proposal_id = %proposal_id, new_quorum = current_quorum, "Successfully updated proposal quorum");
            }
        }
    }

    info!(
        governor = "ARBITRUM_TREASURY",
        "Successfully updated quorum for active and started proposals"
    );

    Ok(())
}
