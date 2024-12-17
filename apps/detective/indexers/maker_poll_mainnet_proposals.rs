use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::{DateTime, Datelike, Utc};
use regex::Regex;
use reqwest::StatusCode;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerType, ProposalState},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tokio::time::sleep;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    maker_poll_create,
    "./abis/maker_poll_create.json"
);

pub struct MakerPollMainnetProposalsIndexer;

#[async_trait]
impl Indexer for MakerPollMainnetProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Proposals
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait::async_trait]
impl ProposalsIndexer for MakerPollMainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Maker Poll Proposals");

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

        let address = address!("f9be8f0945acddeedaa64dfca5fe9629d0cf8e5d");

        let gov_contract = maker_poll_create::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .PollCreated_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, indexer)
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
    p: (maker_poll_create::PollCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (maker_poll_create::PollCreated, Log) = p.clone();

    let created_block_number = meta.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), BlockTransactionsKind::Hashes)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let mut voting_starts_timestamp =
        DateTime::from_timestamp_millis((log.startDate.to::<u64>() * 1000) as i64)
            .context("voting_starts_timestamp")?
            .naive_utc();

    let mut voting_ends_timestamp =
        DateTime::from_timestamp_millis((log.endDate.to::<u64>() * 1000) as i64)
            .context("voting_ends_timestamp")?
            .naive_utc();

    if voting_starts_timestamp.year() > 2100 {
        voting_starts_timestamp = voting_starts_timestamp.with_year(2000).unwrap();
    }

    if voting_ends_timestamp.year() > 2100 {
        voting_ends_timestamp = voting_ends_timestamp.with_year(2000).unwrap();
    }

    let proposal_url = format!(
        "https://vote.makerdao.com/polling/{}",
        log.multiHash.chars().take(8).collect::<String>()
    );

    let proposal_external_id = log.pollId.to_string();

    let title = get_title(log.url.clone()).await.context("get_title")?;

    let body = String::new();

    let mut choices: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    let mut results_data = get_results_data(log.pollId.to_string()).await?.results;

    results_data.sort_by(|a, b| {
        a.optionId
            .as_u64()
            .unwrap()
            .cmp(&b.optionId.as_u64().unwrap())
    });

    for res in results_data {
        let choice = match res.optionName {
            serde_json::Value::String(s) => s,
            serde_json::Value::Number(n) => n.to_string(),
            _ => "Unknown".to_string(),
        };
        choices.push(choice);
        scores.push(res.mkrSupport.as_str().unwrap().parse::<f64>()?);
        scores_total += res.mkrSupport.as_str().unwrap().parse::<f64>()?;
    }

    let state = if voting_ends_timestamp < Utc::now().naive_utc() {
        ProposalState::Executed
    } else {
        ProposalState::Active
    };

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        author: Set(Some(log.creator.to_string())),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: NotSet,
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(0.0),
        quorum: Set(0.0),
        proposal_state: Set(state),
        marked_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        metadata: NotSet,
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.unwrap())
        ))),
    })
}

#[allow(non_snake_case)]
#[derive(Deserialize, Serialize, PartialEq, Debug)]
struct ResultData {
    mkrSupport: serde_json::Value,
    optionName: serde_json::Value,
    optionId: serde_json::Value,
}

#[derive(Deserialize, Serialize, PartialEq, Debug)]
struct ResultsData {
    results: Vec<ResultData>,
}

const MAX_RETRIES: u32 = 5;

async fn get_results_data(poll_id: String) -> Result<ResultsData> {
    let client = reqwest::Client::new();

    for retries in 0..MAX_RETRIES {
        let backoff_duration = Duration::from_millis(2u64.pow(retries));

        match client
            .get(format!(
                "https://vote.makerdao.com/api/polling/tally/{}",
                poll_id
            ))
            .header("Accept", "application/json")
            .header("User-Agent", "insomnia/2023.1.0")
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => match response.text().await {
                Ok(contents) => match serde_json::from_str::<ResultsData>(&contents) {
                    Ok(data) => return Ok(data),
                    Err(_) if retries < MAX_RETRIES - 1 => {
                        sleep(backoff_duration).await;
                    }
                    Err(_) => break,
                },
                Err(_) if retries < MAX_RETRIES - 1 => {
                    sleep(backoff_duration).await;
                }
                Err(_) => break,
            },
            Err(_) if retries < MAX_RETRIES - 1 => {
                sleep(backoff_duration).await;
            }
            Err(_) => break,
        }
    }

    Ok(ResultsData { results: vec![] })
}

async fn get_title(url: String) -> Result<String> {
    let client = reqwest::Client::new();

    for retries in 0..MAX_RETRIES {
        let backoff_duration = Duration::from_millis(2u64.pow(retries));

        match client
            .get(url.clone())
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(res) if res.status() == StatusCode::OK => match res.text().await {
                Ok(text) => {
                    let pattern = r"(?m)^title:\s*(.+)$";
                    let re = Regex::new(pattern)?;
                    let result = re
                        .captures(text.as_str())
                        .and_then(|cap| cap.get(1).map(|m| m.as_str().to_string()))
                        .unwrap_or_else(|| "Unknown".to_string());
                    return Ok(result);
                }
                Err(_) if retries < MAX_RETRIES - 1 => {
                    sleep(backoff_duration).await;
                }
                Err(_) => break,
            },
            Ok(_) if retries < MAX_RETRIES - 1 => {
                sleep(backoff_duration).await;
            }
            Ok(_) => break,
            Err(_) if retries < MAX_RETRIES - 1 => {
                sleep(backoff_duration).await;
            }
            Err(_) => break,
        }
    }

    Ok("Unknown".to_string())
}

#[cfg(test)]
mod maker_poll_mainnet_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn maker_poll_proposals() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 20814312,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
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

        match MakerPollMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 20814312,
                    external_id: "1143",
                    name: "LITE-PSM-USDC-A Phase 3 (Final Migration) Parameter Proposal - September 23, 2024",
                    body_contains: Some(vec![""]),
                    url: "https://vote.makerdao.com/polling/QmRjrFYG",
                    discussion_url: "",
                    choices: json!(["Abstain", "Yes", "No"]),
                    scores: json!([0.0, 87700.50889104782, 0.0]),
                    scores_total: 87700.50889104782,
                    scores_quorum: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-09-23 15:55:23"),
                    time_start: parse_datetime("2024-09-23 16:00:00"),
                    time_end: parse_datetime("2024-09-26 16:00:00"),
                    block_created: Some(20814312),
                    txid: Some(
                        "0x7ee3d65211b36ea87a3f10672018ed6e1a1e6fb1f4cf95076a8bb610d6b27b4a",
                    ),
                    metadata: None,
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
