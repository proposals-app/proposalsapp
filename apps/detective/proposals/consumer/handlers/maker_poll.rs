use crate::ChainProposalsResult;
use anyhow::{Context, Result};
use chrono::{Datelike, NaiveDateTime, Utc};
use contracts::gen::maker_poll_create::maker_poll_create::maker_poll_create;
use contracts::gen::maker_poll_create::PollCreatedFilter;
use ethers::prelude::*;
use regex::Regex;
use reqwest::StatusCode;
use sea_orm::ActiveValue::NotSet;
use sea_orm::Set;
use seaorm::sea_orm_active_enums::ProposalStateEnum;
use seaorm::{dao_handler, proposal};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct Decoder {
    address_create: String,
    proposalUrl: String,
}

pub async fn maker_poll_proposals(
    dao_handler: &dao_handler::Model,
) -> Result<ChainProposalsResult> {
    let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
    let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

    let current_block = eth_rpc
        .get_block_number()
        .await
        .context("get_block_number")?
        .as_u64();

    let from_block = dao_handler.proposals_index;
    let to_block = if dao_handler.proposals_index as u64
        + dao_handler.proposals_refresh_speed as u64
        > current_block
    {
        current_block
    } else {
        dao_handler.proposals_index as u64 + dao_handler.proposals_refresh_speed as u64
    };

    let decoder: Decoder = serde_json::from_value(dao_handler.decoder.clone())?;

    let address = decoder
        .address_create
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

    let mut result = Vec::new();

    for p in proposal_events.iter() {
        let p = data_for_proposal(p.clone(), &eth_rpc, &decoder, dao_handler)
            .await
            .context("data_for_proposal")?;
        result.push(p);
    }

    Ok(ChainProposalsResult {
        proposals: result,
        to_index: Some(to_block as i32),
    })
}

async fn data_for_proposal(
    p: (
        contracts::gen::maker_poll_create::PollCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    decoder: &Decoder,
    dao_handler: &dao_handler::Model,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (PollCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    #[allow(deprecated)]
    let mut voting_starts_timestamp =
        NaiveDateTime::from_timestamp_millis((log.start_date.as_u64() * 1000).try_into().unwrap())
            .context("voting_starts_timestamp")?;

    #[allow(deprecated)]
    let mut voting_ends_timestamp =
        NaiveDateTime::from_timestamp_millis((log.end_date.as_u64() * 1000).try_into().unwrap())
            .context("voting_ends_timestamp")?;

    if voting_starts_timestamp.year() > 2100 {
        voting_starts_timestamp = voting_starts_timestamp.with_year(2000).unwrap();
    }

    if voting_ends_timestamp.year() > 2100 {
        voting_ends_timestamp = voting_ends_timestamp.with_year(2000).unwrap();
    }

    let proposal_url = format!(
        "{}{}",
        decoder.proposalUrl,
        log.multi_hash.chars().take(8).collect::<String>()
    );

    let proposal_external_id = log.poll_id.to_string();

    let title = get_title(log.url).await.context("get_title")?;

    let body = String::from("");

    let discussionurl = String::from("");

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
            _ => "Unknown".to_string(), // handle other cases as needed
        };
        choices.push(choice);
        scores.push(res.mkrSupport.as_str().unwrap().parse::<f64>()? / (10.0f64.powi(18)));
        scores_total += res.mkrSupport.as_str().unwrap().parse::<f64>()? / (10.0f64.powi(18));
    }

    let state = if voting_ends_timestamp.and_utc().timestamp() < Utc::now().timestamp() {
        ProposalStateEnum::Executed
    } else {
        ProposalStateEnum::Active
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
        quorum: Set(0.0f64),
        proposal_state: Set(state),
        flagged: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(Some(created_block_timestamp)),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(created_block_number as i32),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
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
        let backoff_duration = std::time::Duration::from_millis(2u64.pow(retries));

        match client
            .get(format!(
                "https://vote.makerdao.com/api/polling/tally/{:}",
                poll_id
            ))
            .header("Accept", "application/json")
            .header("User-Agent", "insomnia/2023.1.0")
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => match response.text().await {
                Ok(contents) => match serde_json::from_str::<ResultsData>(&contents) {
                    Ok(data) => return Ok(data),
                    Err(_) if retries < MAX_RETRIES - 1 => {
                        tokio::time::sleep(backoff_duration).await;
                    }
                    Err(_) => break,
                },
                Err(_) if retries < MAX_RETRIES - 1 => {
                    tokio::time::sleep(backoff_duration).await;
                }
                Err(_) => break,
            },
            Err(_) if retries < MAX_RETRIES - 1 => {
                tokio::time::sleep(backoff_duration).await;
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
                        .unwrap_or("Unknown".to_string());
                    return Ok(result);
                }
                Err(_) if retries < MAX_RETRIES - 1 => {
                    sleep(backoff_duration).await;
                }
                Err(_) => break,
            },
            Ok(_) if retries < MAX_RETRIES - 1 => {
                // Handle non-OK status here if necessary
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
