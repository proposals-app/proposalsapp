use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    gitcoin_v1_gov,
    "./abis/gitcoin_v1_gov.json"
);

pub struct GitcoinV1MainnetProposalsIndexer;

#[async_trait]
impl Indexer for GitcoinV1MainnetProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::GitcoinMainnetProposals
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for GitcoinV1MainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Gitcoin V1 Proposals");

        let eth_rpc = chain_data::get_chain_config(Chain::Ethereum)?
            .provider
            .clone();

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("DbD27635A534A3d3169Ef0498beB56Fb9c937489");

        let gov_contract = gitcoin_v1_gov::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .ProposalCreated_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal")?;
            proposals.push(p);
        }

        let new_index = proposals
            .iter()
            .filter(|p| {
                matches!(
                    p.proposal_state.as_ref(),
                    ProposalState::Active | ProposalState::Pending
                )
            })
            .filter_map(|p| match &p.index_created {
                ActiveValue::Set(value) => Some(*value),
                _ => None,
            })
            .min()
            .unwrap_or(to_block);

        Ok(ProcessResult::Proposals(proposals, new_index))
    }
}

async fn data_for_proposal(
    p: (gitcoin_v1_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: gitcoin_v1_gov::gitcoin_v1_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (gitcoin_v1_gov::ProposalCreated, Log) = p.clone();

    let created_block = rpc
        .get_block_by_number(
            log.block_number.unwrap().into(),
            BlockTransactionsKind::Hashes,
        )
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Ethereum, voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => {
                let fallback = DateTime::from_timestamp_millis(
                    (log.block_timestamp.unwrap()
                        + (voting_start_block_number - log.block_number.unwrap())
                            * average_block_time_millis) as i64,
                )
                .context("bad timestamp")?
                .naive_utc();
                warn!(
                    "Could not estimate timestamp for {:?}",
                    voting_start_block_number
                );
                info!("Fallback to {:?}", fallback);
                fallback
            }
        };

    let voting_ends_timestamp =
        match chain_data::estimate_timestamp(Chain::Ethereum, voting_end_block_number).await {
            Ok(r) => r,
            Err(_) => {
                let fallback = DateTime::from_timestamp_millis(
                    (log.block_timestamp.unwrap()
                        + (voting_end_block_number - log.block_number.unwrap())
                            * average_block_time_millis) as i64,
                )
                .context("bad timestamp")?
                .naive_utc();
                warn!(
                    "Could not estimate timestamp for {:?}",
                    voting_end_block_number
                );
                info!("Fallback to {:?}", fallback);
                fallback
            }
        };

    let mut title = format!(
        "{:.120}",
        event
            .description
            .split('\n')
            .next()
            .unwrap_or("Unknown")
            .to_string()
    );

    if title.starts_with("# ") {
        title = title.split_off(2);
    }

    if title.is_empty() {
        title = "Unknown".into()
    }

    let body = event.description.to_string();

    let proposal_url = format!("https://www.tally.xyz/gov/gitcoin/proposal/{}", event.id);

    let proposal_external_id = event.id.to_string();

    let onchain_proposal = gov_contract
        .proposals(event.id)
        .call()
        .await
        .context("gov_contract.proposals")?;

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorumVotes()
        .call()
        .await
        .context("gov_contract.quorumVotes")?
        ._0
        .to::<u128>() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(event.id)
        .call()
        .await
        .context("gov_contract.state")?
        ._0;

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

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        author: Set(Some(event.proposer.to_string())),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: NotSet,
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(scores_quorum),
        quorum: Set(quorum),
        proposal_state: Set(state),
        marked_spam: NotSet,
        block_created: Set(Some(log.block_number.unwrap().to_i32().unwrap())),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(log.block_number.unwrap().to_i32().unwrap()),
        metadata: Set(json!({"vote_type": "single-choice","quorum_choices":[0]}).into()),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

#[cfg(test)]
mod gitcoin_1_mainnet_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn gitcoin_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 17294135,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match GitcoinV1MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 17294135,
                    external_id: "57",
                    name: "S18-S19 Gitcoin Public Goods Funding Workstream Budget",
                    body_contains: None,
                    url: "https://www.tally.xyz/gov/gitcoin/proposal/57",
                    discussion_url: None,
                    choices: json!(["For", "Against"]),
                    scores: json!([4684322.90448519, 0.0]),
                    scores_total: 4684322.90448519,
                    scores_quorum: 4684322.90448519,
                    quorum: 2500000.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2023-05-19 14:29:59"),
                    time_start: parse_datetime("2023-05-21 10:53:23"),
                    time_end: parse_datetime("2023-05-27 03:03:11"),
                    block_created: Some(17294135),
                    txid: Some(
                        "0x8b8392802f262bee5edf3730f9d1adcacb26f324e96790d070b8332f199bd066",
                    ),
                    metadata: json!({"vote_type": "single-choice","quorum_choices":[0]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
