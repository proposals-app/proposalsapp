#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_core_governor::{ArbitrumCoreGovernorEventType, ProposalCreatedEvent, ProposalExecutedEvent, ProposalExtendedEvent, VoteCastEvent, no_extensions};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_GOVERNOR_ID_MAP, DAO_ID_SLUG_MAP, DB, store_proposal, store_votes},
    },
    rindexer_lib::typings::rindexer::events::arbitrum_core_governor::arbitrum_core_governor_contract,
};
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use ethers::{
    types::{U64, U256},
    utils::{hex::ToHex, to_checksum},
};
use proposalsapp_db_indexer::models::{proposal, sea_orm_active_enums::ProposalState, vote};
use rindexer::{EthereumSqlTypeWrapper, PgType, PostgresClient, RindexerColorize, event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus, rindexer_error};
use sea_orm::{
    ActiveValue::{self, NotSet},
    ConnectionTrait, Set,
    prelude::Uuid,
};
use serde_json::json;
use std::{path::PathBuf, sync::Arc};
use tracing::{info, instrument};

fn get_proposals_governor_id() -> Option<Uuid> {
    DAO_GOVERNOR_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("ARBITRUM_CORE")
        .copied()
}

fn get_votes_governor_id() -> Option<Uuid> {
    DAO_GOVERNOR_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("ARBITRUM_CORE")
        .copied()
}

fn get_dao_id() -> Option<Uuid> {
    DAO_ID_SLUG_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get("arbitrum")
        .copied()
}

#[instrument(skip(manifest_path, registry))]
async fn proposal_created_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                info!(
                    event = "ArbitrumCoreGovernor::ProposalCreated",
                    status = "INDEXED".green().to_string(),
                    results = results.len(),
                );

                for result in results.clone() {
                    let arbitrum_core_governor = arbitrum_core_governor_contract("arbitrum");

                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let start_at = estimate_timestamp("ethereum", result.event_data.start_block.as_u64())
                        .await
                        .expect("Failed to estimate start timestamp");

                    let end_at = estimate_timestamp("ethereum", result.event_data.end_block.as_u64())
                        .await
                        .expect("Failed to estimate end timestamp");

                    let title = extract_title(&result.event_data.description);

                    let proposal_url = format!(
                        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
                        result.event_data.proposal_id
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

                    let total_delegated_vp = calculate_total_delegated_vp(created_at)
                        .await
                        .expect("Failed to calculate total delegated voting power");

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
                        name: Set(title),
                        body: Set(result.event_data.description),
                        url: Set(proposal_url),
                        discussion_url: NotSet,
                        choices: Set(json!(choices)),
                        quorum: Set(quorum),
                        proposal_state: Set(state),
                        marked_spam: NotSet,
                        created_at: Set(created_at),
                        start_at: Set(start_at),
                        end_at: Set(end_at),
                        block_created_at: Set(Some(result.tx_information.block_number.as_u64() as i32)),
                        metadata: Set(json!({"vote_type":"basic", "quorum_choices":[0,2],"total_delegated_vp":total_delegated_vp, "targets":result.event_data.targets, "values":result.event_data.values, "calldatas":result.event_data.calldatas, "signatures":result.event_data.signatures}).into()),
                        txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                        governor_id: Set(get_proposals_governor_id().take().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: Set(Some(to_checksum(&result.event_data.proposer, None))),
                    };

                    store_proposal(proposal).await;
                }

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(skip(manifest_path, registry))]
async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                info!(
                    event = "ArbitrumCoreGovernor::ProposalExecuted",
                    status = "INDEXED".green().to_string(),
                    results = results.len(),
                );

                for result in results.clone() {
                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
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
                        metadata: NotSet,
                        txid: NotSet,
                        governor_id: Set(get_proposals_governor_id().take().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: NotSet,
                    };

                    store_proposal(proposal).await;
                }

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(skip(manifest_path, registry))]
async fn proposal_extended_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::ProposalExtended(
        ProposalExtendedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                info!(
                    event = "ArbitrumCoreGovernor::ProposalExtended",
                    status = "INDEXED".green().to_string(),
                    results = results.len(),
                );

                for result in results.clone() {
                    let end_at = estimate_timestamp("ethereum", result.event_data.extended_deadline)
                        .await
                        .expect("Failed to estimate end timestamp");

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
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
                        metadata: NotSet,
                        txid: NotSet,
                        governor_id: Set(get_proposals_governor_id().take().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                        author: NotSet,
                    };

                    store_proposal(proposal).await;
                }

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(skip(manifest_path, registry))]
async fn vote_cast_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumCoreGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                info!(
                    event = "ArbitrumCoreGovernor::VoteCast",
                    status = "INDEXED".green().to_string(),
                    results = results.len(),
                );

                let mut votes = vec![];

                for result in results.clone() {
                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let vote = vote::ActiveModel {
                        id: NotSet,
                        voter_address: Set(to_checksum(&result.event_data.voter, None)),
                        choice: Set(match result.event_data.support {
                            0 => 1.into(),
                            1 => 0.into(),
                            2 => 2.into(),
                            _ => 2.into(),
                        }),
                        voting_power: Set((result.event_data.weight.as_u128() as f64) / (10.0f64.powi(18))),
                        reason: Set(Some(result.event_data.reason)),
                        created_at: Set(created_at),
                        block_created_at: Set(Some(result.tx_information.block_number.as_u64() as i32)),
                        txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                        proposal_external_id: Set(result.event_data.proposal_id.to_string()),
                        proposal_id: NotSet,
                        governor_id: Set(get_votes_governor_id().take().unwrap()),
                        dao_id: Set(get_dao_id().unwrap()),
                    };

                    votes.push(vote);
                }

                store_votes(votes, get_proposals_governor_id().take().unwrap()).await;

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}

#[instrument(skip(manifest_path, registry))]
pub async fn arbitrum_core_governor_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    proposal_created_handler(manifest_path, registry).await;

    proposal_executed_handler(manifest_path, registry).await;

    proposal_extended_handler(manifest_path, registry).await;

    vote_cast_handler(manifest_path, registry).await;
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

#[instrument(skip(timestamp))]
async fn calculate_total_delegated_vp(timestamp: NaiveDateTime) -> Result<f64> {
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

    Ok(total_vp)
}
