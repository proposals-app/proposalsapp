use crate::indexer::Indexer;
use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, Utc};
use contracts::gen::maker_poll_create::{maker_poll_create::maker_poll_create, PollCreatedFilter};
use ethers::prelude::*;
use regex::Regex;
use reqwest::StatusCode;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};
use tokio::time::sleep;
use tracing::info;

pub struct MakerPollMainnetProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for MakerPollMainnetProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Maker Poll Proposals");

        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("get_block_number")?
            .as_u32() as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = "0xf9be8f0945acddeedaa64dfca5fe9629d0cf8e5d"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = maker_poll_create::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .poll_created_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, indexer)
                .await
                .context("data_for_proposal")?;
            proposals.push(p);
        }

        Ok((proposals, Vec::new(), to_block))
    }

    fn min_refresh_speed(&self) -> i32 {
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (PollCreatedFilter, LogMeta),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (PollCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let mut voting_starts_timestamp =
        DateTime::from_timestamp_millis((log.start_date.as_u64() * 1000) as i64)
            .context("voting_starts_timestamp")?
            .naive_utc();

    let mut voting_ends_timestamp =
        DateTime::from_timestamp_millis((log.end_date.as_u64() * 1000) as i64)
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
        log.multi_hash.chars().take(8).collect::<String>()
    );

    let proposal_external_id = log.poll_id.to_string();

    let title = get_title(log.url).await.context("get_title")?;

    let body = String::new();

    let discussionurl = String::new();

    let mut choices: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    let mut results_data = get_results_data(log.poll_id.to_string()).await?.results;

    results_data.sort_by(|a, b| {
        a.optionId
            .as_u64()
            .unwrap()
            .cmp(&b.optionId.as_u64().unwrap())
    });

    for res in results_data {
        let choice = match res.optionName {
            Value::String(s) => s,
            Value::Number(n) => n.to_string(),
            _ => "Unknown".to_string(),
        };
        choices.push(choice);
        scores.push(res.mkrSupport.as_str().unwrap().parse::<f64>()? / (10.0f64.powi(18)));
        scores_total += res.mkrSupport.as_str().unwrap().parse::<f64>()? / (10.0f64.powi(18));
    }

    let state = if voting_ends_timestamp < Utc::now().naive_utc() {
        ProposalState::Executed
    } else {
        ProposalState::Active
    };

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: Set(discussionurl),
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(0.0),
        quorum: Set(0.0),
        proposal_state: Set(state),
        marked_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        metadata: NotSet,
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.as_bytes())
        ))),
    })
}

#[allow(non_snake_case)]
#[derive(Deserialize, Serialize, PartialEq, Debug)]
struct ResultData {
    mkrSupport: Value,
    optionName: Value,
    optionId: Value,
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
