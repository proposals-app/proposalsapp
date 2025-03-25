#![allow(non_snake_case)]
use super::super::super::typings::rindexer::events::arbitrum_sc_nominations::{ArbitrumSCNominationsEventType, ProposalCreatedEvent, ProposalExecutedEvent, no_extensions};
use crate::{
    extensions::{
        block_time::estimate_timestamp,
        db_extension::{DAO_GOVERNOR_ID_MAP, DAO_ID_SLUG_MAP, store_proposal},
    },
    rindexer_lib::typings::rindexer::events::arbitrum_sc_nominations::arbitrum_sc_nominations_contract,
};
use ethers::{
    types::U256,
    utils::{hex::ToHex, to_checksum},
};
use proposalsapp_db_indexer::models::{proposal, sea_orm_active_enums::ProposalState};
use regex::Regex;
use rindexer::{EthereumSqlTypeWrapper, PgType, RindexerColorize, event::callback_registry::EventCallbackRegistry, indexer::IndexingEventProgressStatus, rindexer_error, rindexer_info};
use sea_orm::{
    ActiveValue::{NotSet, Set},
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
        .get("ARBITRUM_SC_NOMINATIONS")
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
    ArbitrumSCNominationsEventType::ProposalCreated(
        ProposalCreatedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                info!(
                    "{} - {} - {}",
                    "ArbitrumSCNominations::ProposalCreated",
                    results.len(),
                    "INDEXED".green().to_string(),
                );

                for result in results.clone() {
                    let arbitrum_sc_nominations_governor = arbitrum_sc_nominations_contract("arbitrum");

                    let created_at = estimate_timestamp("arbitrum", result.tx_information.block_number.as_u64())
                        .await
                        .expect("Failed to estimate created timestamp");

                    let start_at = estimate_timestamp("ethereum", result.event_data.start_block.as_u64())
                        .await
                        .expect("Failed to estimate start timestamp");

                    let end_at = estimate_timestamp("ethereum", result.event_data.end_block.as_u64())
                        .await
                        .expect("Failed to estimate end timestamp");

                    let url_regex = Regex::new(r"Security Council Election #(\d+)").unwrap();

                    let proposal_url = url_regex
                        .captures(&result.event_data.description)
                        .and_then(|caps| caps.get(1).map(|m| m.as_str()))
                        .map_or_else(String::new, |election_number| {
                            format!(
                                "https://www.tally.xyz/gov/arbitrum/council/security-council/election/{}/round-1",
                                election_number
                            )
                        });

                    let proposal_state = arbitrum_sc_nominations_governor
                        .state(result.event_data.proposal_id)
                        .call()
                        .await
                        .expect("Failed to fetch proposal state");

                    let proposal_snapshot_block = arbitrum_sc_nominations_governor
                        .proposal_snapshot(result.event_data.proposal_id)
                        .call()
                        .await
                        .expect("Failed to fetch proposal snapshot block");

                    let quorum = match arbitrum_sc_nominations_governor
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

                    let proposal = proposal::ActiveModel {
                        id: NotSet,
                        external_id: Set(result.event_data.proposal_id.to_string()),
                        name: Set(result.event_data.description.clone()),
                        body: Set(result.event_data.description.clone()),
                        url: Set(proposal_url),
                        discussion_url: NotSet,
                        choices: Set(json!([])),
                        quorum: Set(quorum),
                        proposal_state: Set(state),
                        marked_spam: NotSet,
                        created_at: Set(created_at),
                        start_at: Set(start_at),
                        end_at: Set(end_at),
                        block_created_at: Set(Some(result.tx_information.block_number.as_u64() as i32)),
                        metadata: Set(json!({"vote_type":"sc_nominations"}).into()),
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

async fn proposal_executed_handler(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    ArbitrumSCNominationsEventType::ProposalExecuted(
        ProposalExecutedEvent::handler(
            |results, context| async move {
                if results.is_empty() {
                    return Ok(());
                }

                info!(
                    "{} - {} - {}",
                    "ArbitrumSCNominations::ProposalExecuted",
                    results.len(),
                    "INDEXED".green().to_string(),
                );

                Ok(())
            },
            no_extensions(),
        )
        .await,
    )
    .register(manifest_path, registry);
}
pub async fn arbitrum_sc_nominations_handlers(manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
    proposal_created_handler(manifest_path, registry).await;

    proposal_executed_handler(manifest_path, registry).await;
}
