#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_treasury_governor::{no_extensions, ArbitrumTreasuryGovernorEventType, ProposalCanceledEvent, ProposalCreatedEvent, ProposalExecutedEvent, ProposalExtendedEvent, ProposalQueuedEvent, VoteCastEvent, VoteCastWithParamsEvent};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{store_proposals, store_votes, DAO_ID_SLUG_MAP, DAO_INDEXER_ID_MAP, DB},
    },
    rindexer_lib::typings::rindexer::events::arbitrum_treasury_governor::arbitrum_treasury_governor_contract,
};
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use ethers::{
    types::U256,
    utils::{hex::ToHex, to_checksum},
};
use proposalsapp_db::models::{
    proposal_new,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
    vote_new,
};
use rindexer::{event::callback_registry::EventCallbackRegistry, rindexer_error, rindexer_info, EthereumSqlTypeWrapper, PgType, RindexerColorize};
use sea_orm::{
    prelude::Uuid,
    ActiveValue::{self, NotSet},
    ConnectionTrait, Set,
};
use serde_json::json;
use std::{path::PathBuf, sync::Arc};

fn get_proposals_dao_indexer_id() -> ActiveValue<Uuid> {
    DAO_INDEXER_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get(&IndexerVariant::ArbTreasuryArbitrumProposals)
        .map(|id| Set(*id))
        .unwrap_or(NotSet)
}

fn get_votes_dao_indexer_id() -> ActiveValue<Uuid> {
    DAO_INDEXER_ID_MAP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .get(&IndexerVariant::ArbTreasuryArbitrumVotes)
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

async fn proposal_canceled_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::ProposalCanceled(
        ProposalCanceledEvent::handler(
            |results, context| async move {
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "proposal_canceled"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals = vec![];

                for result in results.clone() {
                    let proposal = proposal_new::ActiveModel {
                        id: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        quorum: NotSet,
                        proposal_state: Set(ProposalState::Canceled),
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: NotSet,
                        block_created_at: NotSet,
                        metadata: NotSet,
                        txid: NotSet,
                        dao_indexer_id: get_proposals_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: NotSet,
                    };

                    proposals.push(proposal);
                }

                match store_proposals(proposals.clone()).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::ProposalCanceled - {} - {}",
                        "STORED".blue(),
                        proposals.len(),
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::ProposalCanceled - {} - {}",
                        "NOT STORED".red(),
                        e.to_string(),
                    ),
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
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "proposal_created"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals = vec![];

                for result in results.clone() {
                    let arbitrum_core_governor = arbitrum_treasury_governor_contract("arbitrum");

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

                    let proposal = proposal_new::ActiveModel {
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
                        metadata: Set(json!({"vote_type": "basic","quorum_choices":[0,2],"total_delegated_vp": total_delegated_vp}).into()),
                        txid: Set(Some(result.tx_information.transaction_hash.encode_hex())),
                        dao_indexer_id: get_proposals_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: Set(Some(to_checksum(&result.event_data.proposer, None))),
                    };

                    proposals.push(proposal);
                }

                match store_proposals(proposals.clone()).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::ProposalCreated - {} - {}",
                        "STORED".blue(),
                        proposals.len(),
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::ProposalCreated - {} - {}",
                        "NOT STORED".red(),
                        e.to_string()
                    ),
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
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "proposal_executed"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals = vec![];

                for result in results.clone() {
                    let proposal = proposal_new::ActiveModel {
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
                        dao_indexer_id: get_proposals_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: NotSet,
                    };

                    proposals.push(proposal);
                }

                match store_proposals(proposals.clone()).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::ProposalExecuted - {} - {}",
                        "STORED".blue(),
                        proposals.len(),
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::ProposalExecuted - {} - {}",
                        "NOT STORED".red(),
                        e.to_string(),
                    ),
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
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "proposal_extended"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals = vec![];

                for result in results.clone() {
                    let end_at = estimate_timestamp("ethereum", result.event_data.extended_deadline)
                        .await
                        .expect("Failed to estimate end timestamp");

                    let proposal = proposal_new::ActiveModel {
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
                        dao_indexer_id: get_proposals_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: NotSet,
                    };

                    proposals.push(proposal);
                }

                match store_proposals(proposals.clone()).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::ProposalExtended - {} - {}",
                        "STORED".blue(),
                        proposals.len(),
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::ProposalExtended - {} - {}",
                        "NOT STORED".red(),
                        e.to_string(),
                    ),
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
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "proposal_queued"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut proposals = vec![];

                for result in results.clone() {
                    let proposal = proposal_new::ActiveModel {
                        id: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
                        name: NotSet,
                        body: NotSet,
                        url: NotSet,
                        discussion_url: NotSet,
                        choices: NotSet,
                        quorum: NotSet,
                        proposal_state: Set(ProposalState::Queued),
                        marked_spam: NotSet,
                        created_at: NotSet,
                        start_at: NotSet,
                        end_at: NotSet,
                        block_created_at: NotSet,
                        metadata: NotSet,
                        txid: NotSet,
                        dao_indexer_id: get_proposals_dao_indexer_id(),
                        dao_id: get_dao_id(),
                        author: NotSet,
                    };

                    proposals.push(proposal);
                }

                match store_proposals(proposals.clone()).await {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::ProposalQueued - {} - {}",
                        "STORED".blue(),
                        proposals.len()
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::ProposalQueued - {} - {}",
                        "NOT STORED".red(),
                        e.to_string(),
                    ),
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

async fn vote_cast_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::VoteCast(
        VoteCastEvent::handler(
            |results, context| async move {
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "vote_cast"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut votes = vec![];

                for result in results.clone() {
                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let vote = vote_new::ActiveModel {
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
                        dao_id: get_dao_id(),
                        indexer_id: get_votes_dao_indexer_id(),
                    };

                    votes.push(vote);
                }

                match store_votes(
                    votes.clone(),
                    get_proposals_dao_indexer_id().take().unwrap(),
                )
                .await
                {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::VoteCast - {} - {}",
                        "STORED".blue(),
                        votes.len()
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::VoteCast - {} - {}",
                        "NOT STORED".red(),
                        e.to_string()
                    ),
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

async fn vote_cast_with_params_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumTreasuryGovernorEventType::VoteCastWithParams(
        VoteCastWithParamsEvent::handler(
            |results, context| async move {
                let to_block = results
                    .iter()
                    .map(|r| r.tx_information.block_number)
                    .max()
                    .unwrap();

                context
                    .database
                    .execute(
                        &format!(
                            "UPDATE rindexer_internal.{}_{}_{} SET last_synced_block = $1 WHERE network = $2 AND $1 > last_synced_block",
                            "rindexer", "arbitrum_treasury_governor", "vote_cast_with_params"
                        ),
                        &[&EthereumSqlTypeWrapper::U64(to_block), &"arbitrum"],
                    )
                    .await;

                if results.is_empty() {
                    return Ok(());
                }

                let mut votes = vec![];

                for result in results.clone() {
                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let vote = vote_new::ActiveModel {
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
                        dao_id: get_dao_id(),
                        indexer_id: get_votes_dao_indexer_id(),
                    };

                    votes.push(vote);
                }

                match store_votes(
                    votes.clone(),
                    get_proposals_dao_indexer_id().take().unwrap(),
                )
                .await
                {
                    Ok(_) => rindexer_info!(
                        "ArbitrumTreasuryGovernor::VoteCastWithParams - {} - {}",
                        "STORED".blue(),
                        votes.len(),
                    ),
                    Err(e) => rindexer_error!(
                        "ArbitrumTreasuryGovernor::VoteCastWithParams - {} - {}",
                        "NOT STORED".red(),
                        e.to_string()
                    ),
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
pub async fn arbitrum_treasury_governor_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    proposal_canceled_handler(manifest_path, registry).await;

    proposal_created_handler(manifest_path, registry).await;

    proposal_executed_handler(manifest_path, registry).await;

    proposal_extended_handler(manifest_path, registry).await;

    proposal_queued_handler(manifest_path, registry).await;

    vote_cast_handler(manifest_path, registry).await;

    vote_cast_with_params_handler(manifest_path, registry).await;
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
