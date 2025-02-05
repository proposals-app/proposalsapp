#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_treasury_governor::{
    no_extensions, ArbitrumTreasuryGovernorEventType, InitializedEvent,
    LateQuorumVoteExtensionSetEvent, OwnershipTransferredEvent, ProposalCanceledEvent,
    ProposalCreatedEvent, ProposalExecutedEvent, ProposalExtendedEvent, ProposalQueuedEvent,
    ProposalThresholdSetEvent, QuorumNumeratorUpdatedEvent, TimelockChangeEvent, VoteCastEvent,
    VoteCastWithParamsEvent, VotingDelaySetEvent, VotingPeriodSetEvent,
};
use rindexer::{
    event::callback_registry::EventCallbackRegistry, rindexer_error, rindexer_info,
    EthereumSqlTypeWrapper, PgType, RindexerColorize,
};
use std::path::PathBuf;
use std::sync::Arc;

async fn initialized_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::Initialized(
        InitializedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::Initialized - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::LateQuorumVoteExtensionSet(
        LateQuorumVoteExtensionSetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::LateQuorumVoteExtensionSet - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::OwnershipTransferred(
        OwnershipTransferredEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::OwnershipTransferred - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::ProposalCanceled(
        ProposalCanceledEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::ProposalCanceled - {} - {} events",
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

async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::ProposalCreated - {} - {} events",
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

async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::ProposalExecuted - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::ProposalExtended(
        ProposalExtendedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::ProposalExtended - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::ProposalQueued(
        ProposalQueuedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::ProposalQueued - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::ProposalThresholdSet(
        ProposalThresholdSetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::ProposalThresholdSet - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::QuorumNumeratorUpdated(
        QuorumNumeratorUpdatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::QuorumNumeratorUpdated - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::TimelockChange(
        TimelockChangeEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::TimelockChange - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::VoteCast - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::VoteCastWithParams(
        VoteCastWithParamsEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::VoteCastWithParams - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::VotingDelaySet(
        VotingDelaySetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::VotingDelaySet - {} - {} events",
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
    ArbitrumTreasuryGovernorEventType::VotingPeriodSet(
        VotingPeriodSetEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                rindexer_info!(
                    "ArbitrumTreasuryGovernor::VotingPeriodSet - {} - {} events",
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
pub async fn arbitrum_treasury_governor_handlers(
    manifest_path: &PathBuf,
    registry: &mut EventCallbackRegistry,
) {
    initialized_handler(manifest_path, registry).await;

    late_quorum_vote_extension_set_handler(manifest_path, registry).await;

    ownership_transferred_handler(manifest_path, registry).await;

    proposal_canceled_handler(manifest_path, registry).await;

    proposal_created_handler(manifest_path, registry).await;

    proposal_executed_handler(manifest_path, registry).await;

    proposal_extended_handler(manifest_path, registry).await;

    proposal_queued_handler(manifest_path, registry).await;

    proposal_threshold_set_handler(manifest_path, registry).await;

    quorum_numerator_updated_handler(manifest_path, registry).await;

    timelock_change_handler(manifest_path, registry).await;

    vote_cast_handler(manifest_path, registry).await;

    vote_cast_with_params_handler(manifest_path, registry).await;

    voting_delay_set_handler(manifest_path, registry).await;

    voting_period_set_handler(manifest_path, registry).await;
}
