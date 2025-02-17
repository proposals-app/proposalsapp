#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_core_governor::{
    no_extensions, ArbitrumCoreGovernorEventType, InitializedEvent,
    LateQuorumVoteExtensionSetEvent, OwnershipTransferredEvent, ProposalCanceledEvent,
    ProposalCreatedEvent, ProposalExecutedEvent, ProposalExtendedEvent, ProposalQueuedEvent,
    ProposalThresholdSetEvent, QuorumNumeratorUpdatedEvent, TimelockChangeEvent, VoteCastEvent,
    VoteCastWithParamsEvent, VotingDelaySetEvent, VotingPeriodSetEvent,
};
use crate::extensions::db_extension::{store_proposals, DAO_ID_SLUG_MAP, DAO_INDEXER_ID_MAP};
use crate::rindexer_lib::typings::networks::get_arbitrum_provider;
use crate::rindexer_lib::typings::rindexer::events::arbitrum_core_governor::arbitrum_core_governor_contract;
use anyhow::Context;
use chrono::DateTime;
use ethers::providers::Middleware;
use ethers::types::U256;
use ethers::utils::hex;
use proposalsapp_db::models::proposal;
use proposalsapp_db::models::sea_orm_active_enums::{IndexerVariant, ProposalState};
use rindexer::{
    event::callback_registry::EventCallbackRegistry, rindexer_error, rindexer_info,
    EthereumSqlTypeWrapper, PgType, RindexerColorize,
};
use sea_orm::prelude::Uuid;
use sea_orm::ActiveValue::{self, NotSet};
use sea_orm::Set;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

fn get_dao_indexer_id() -> ActiveValue<Uuid> {
    DAO_INDEXER_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get(&IndexerVariant::ArbCoreArbitrumProposals)
        .map(|id| Set(*id))
        .unwrap_or(NotSet)
}

fn get_dao_id() -> ActiveValue<Uuid> {
    DAO_ID_SLUG_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .map(|id| Set(*id))
        .unwrap_or(NotSet)
}

async fn initialized_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::Initialized(
        InitializedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::Initialized - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn late_quorum_vote_extension_set_handler(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    ArbitrumCoreGovernorEventType::LateQuorumVoteExtensionSet(
        LateQuorumVoteExtensionSetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::LateQuorumVoteExtensionSet - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn ownership_transferred_handler(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    ArbitrumCoreGovernorEventType::OwnershipTransferred(
        OwnershipTransferredEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::OwnershipTransferred - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn proposal_canceled_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalCanceled(
        ProposalCanceledEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals: Vec<proposal::ActiveModel> = Vec::new();

                for result in results.clone() {
                    proposals.push(proposal::ActiveModel {
                        id: NotSet,
                        index_created: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        scores: NotSet,
                        scores_total: NotSet,
                        quorum: NotSet,
                        scores_quorum: NotSet,
                        proposal_state: Set(ProposalState::Canceled),
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: NotSet,
                        block_created: NotSet,
                        txid: NotSet,
                        metadata: NotSet,
                        dao_indexer_id: get_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: NotSet,
                    });
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::ProposalCanceled - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                match store_proposals(proposals).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumCoreGovernor::ProposalCanceled - {} - {} events",
                        "STORED".green(),
                        results.len(),
                    ),
                    Err(_) => rindexer_info!(
                        "ArbitrumCoreGovernor::ProposalCanceled - {} - {} events",
                        "NOT STORED".red(),
                        results.len(),
                    ),
                }

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals: Vec<proposal::ActiveModel> = Vec::new();

                for result in results.clone() {
                    let arbitrum_core_governor = arbitrum_core_governor_contract("ethereum");

                    let created_block_timestamp = get_arbitrum_provider()
                        .get_block(result.tx_information.block_number)
                        .await
                        .context("Failed to fetch block")
                        .unwrap()
                        .unwrap()
                        .timestamp;

                    let created_block_datetime =
                        DateTime::from_timestamp(created_block_timestamp.as_u64() as i64, 0)
                            .context("Failed to convert timestamp to datetime")
                            .unwrap()
                            .naive_utc();

                    let title = extract_title(&result.event_data.description);

                    let proposal_url = format!(
                        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
                        result.event_data.proposal_id.to_string()
                    );

                    let choices = vec!["For", "Against", "Abstain"];

                    let proposal_state = arbitrum_core_governor
                        .state(result.event_data.proposal_id)
                        .call()
                        .await
                        .expect("Failed to fetch proposal state");

                    let proposal_snapshot_block = arbitrum_core_governor
                        .proposal_snapshot(result.event_data.proposal_id)
                        .call()
                        .await
                        .expect("Failed to fetch proposal snapshot block");

                    let quorum = match arbitrum_core_governor
                        .quorum(proposal_snapshot_block)
                        .call()
                        .await
                    {
                        Ok(r) => r.as_u128() as f64 / (10.0f64.powi(18)),
                        Err(_) => U256::from(0).as_u128() as f64 / (10.0f64.powi(18)),
                    };

                    let state = match proposal_state {
                        0 => ProposalState::Pending,
                        1 => ProposalState::Active,
                        2 => ProposalState::Canceled,
                        3 => ProposalState::Defeated,
                        4 => ProposalState::Succeeded,
                        5 => ProposalState::Queued,
                        6 => ProposalState::Expired,
                        7 => ProposalState::Executed,
                        _ => ProposalState::Unknown,
                    };

                    proposals.push(proposal::ActiveModel {
                        id: NotSet,
                        index_created: Set(result.tx_information.block_number.as_u64() as i32),
                        external_id: Set(result.event_data.proposal_id.to_string()),
                        name: Set(title),
                        body: Set(result.event_data.description),
                        url: Set(proposal_url),
                        discussion_url: NotSet,
                        choices: Set(json!(choices)),
                        scores: NotSet,
                        scores_total: NotSet,
                        quorum: Set(quorum),
                        scores_quorum: NotSet,
                        proposal_state: Set(state),
                        marked_spam: NotSet,
                        created_at: Set(created_block_datetime),
                        start_at: NotSet,
                        end_at: NotSet,
                        block_created: Set(
                            Some(result.tx_information.block_number.as_u64() as i32),
                        ),
                        metadata: NotSet,
                        txid: Set(Some(hex::encode(
                            result.tx_information.transaction_hash.to_string(),
                        ))),
                        dao_indexer_id: get_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: NotSet,
                    });
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::ProposalCanceled - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                match store_proposals(proposals).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumCoreGovernor::ProposalCanceled - {} - {} events",
                        "STORED".green(),
                        results.len(),
                    ),
                    Err(_) => rindexer_info!(
                        "ArbitrumCoreGovernor::ProposalCanceled - {} - {} events",
                        "NOT STORED".red(),
                        results.len(),
                    ),
                }

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::ProposalExecuted - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn proposal_extended_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalExtended(
        ProposalExtendedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::ProposalExtended - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn proposal_queued_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalQueued(
        ProposalQueuedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::ProposalQueued - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn proposal_threshold_set_handler(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    ArbitrumCoreGovernorEventType::ProposalThresholdSet(
        ProposalThresholdSetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::ProposalThresholdSet - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn quorum_numerator_updated_handler(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    ArbitrumCoreGovernorEventType::QuorumNumeratorUpdated(
        QuorumNumeratorUpdatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::QuorumNumeratorUpdated - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn timelock_change_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::TimelockChange(
        TimelockChangeEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::TimelockChange - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn vote_cast_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::VoteCast - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn vote_cast_with_params_handler(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    ArbitrumCoreGovernorEventType::VoteCastWithParams(
        VoteCastWithParamsEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::VoteCastWithParams - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn voting_delay_set_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::VotingDelaySet(
        VotingDelaySetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::VotingDelaySet - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

async fn voting_period_set_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::VotingPeriodSet(
        VotingPeriodSetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumCoreGovernor::VotingPeriodSet - {} - {} events",
                    "INDEXED".green(),
                    results.len(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}
pub async fn arbitrum_core_governor_handlers(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    // initialized_handler(manifest_path, registry).await;

    // late_quorum_vote_extension_set_handler(manifest_path, registry).await;

    // ownership_transferred_handler(manifest_path, registry).await;

    proposal_canceled_handler(manifest_path, registry).await;

    proposal_created_handler(manifest_path, registry).await;

    proposal_executed_handler(manifest_path, registry).await;

    proposal_extended_handler(manifest_path, registry).await;

    proposal_queued_handler(manifest_path, registry).await;

    // proposal_threshold_set_handler(manifest_path, registry).await;

    // quorum_numerator_updated_handler(manifest_path, registry).await;

    // timelock_change_handler(manifest_path, registry).await;

    vote_cast_handler(manifest_path, registry).await;

    vote_cast_with_params_handler(manifest_path, registry).await;

    // voting_delay_set_handler(manifest_path, registry).await;

    // voting_period_set_handler(manifest_path, registry).await;
}

fn extract_title(description: &str) -> String {
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
