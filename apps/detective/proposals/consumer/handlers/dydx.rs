use crate::ChainProposalsResult;
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use contracts::gen::dydx_executor::dydx_executor::dydx_executor;
use contracts::gen::dydx_gov::dydx_gov::dydx_gov;
use contracts::gen::dydx_gov::ProposalCreatedFilter;
use contracts::gen::dydx_strategy::dydx_strategy::dydx_strategy;
use ethers::prelude::*;
use ethers::utils::hex;
use regex::Regex;
use scanners::etherscan::estimate_timestamp;
use sea_orm::ActiveValue::NotSet;
use sea_orm::Set;
use seaorm::sea_orm_active_enums::ProposalStateEnum;
use seaorm::{dao_handler, proposal};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
    proposalUrl: String,
}

pub async fn dydx_proposals(dao_handler: &dao_handler::Model) -> Result<ChainProposalsResult> {
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

    let address = decoder.address.parse::<Address>().context("bad address")?;

    let gov_contract = dydx_gov::new(address, eth_rpc.clone());

    let proposal_events = gov_contract
        .proposal_created_filter()
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("query_with_meta")?;

    let mut result = Vec::new();

    for p in proposal_events.iter() {
        let p = data_for_proposal(
            p.clone(),
            &eth_rpc,
            &decoder,
            dao_handler,
            gov_contract.clone(),
        )
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
    p: (contracts::gen::dydx_gov::ProposalCreatedFilter, LogMeta),
    rpc: &Arc<Provider<Http>>,
    decoder: &Decoder,
    dao_handler: &dao_handler::Model,
    gov_contract: dydx_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let voting_start_block_number = log.start_block.as_u64();
    let voting_end_block_number = log.end_block.as_u64();

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 12 * 1000,
        )
        .context("bad timestamp")?,
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 12 * 1000,
        )
        .context("bad timestamp")?,
    };

    let proposal_url = format!("{}{}", decoder.proposalUrl, log.id);

    let proposal_external_id = log.id.to_string();

    let executor_contract = dydx_executor::new(log.executor, rpc.clone());

    let strategy_contract = dydx_strategy::new(log.strategy, rpc.clone());

    let total_voting_power = strategy_contract
        .get_total_voting_supply_at(U256::from(meta.block_number.as_u64()))
        .await
        .context("strategy_contract.get_total_voting_supply_at")
        .unwrap_or_default();

    let min_quorum = executor_contract
        .minimum_quorum()
        .await
        .context("executor_contract.minimum_quorum")?;

    let one_hunded_with_precision = executor_contract
        .one_hundred_with_precision()
        .await
        .context("executor_contract.one_hundred_with_precision")?;

    let quorum = ((total_voting_power * min_quorum) / one_hunded_with_precision).as_u128() as f64
        / (10.0f64.powi(18));

    let onchain_proposal = gov_contract
        .get_proposal_by_id(log.id)
        .call()
        .await
        .context("gov_contract.get_proposal_by_id")?;

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.for_votes.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.against_votes.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let hash: Vec<u8> = log.ipfs_hash.into();

    let title = get_title(hex::encode(hash.clone()))
        .await
        .context("get_title")?;
    let body = get_body(hex::encode(hash.clone()))
        .await
        .context("get_body")?;
    let discussionurl = get_discussion(hex::encode(hash.clone()))
        .await
        .context("get_discussion")?;

    let proposal_state = gov_contract
        .get_proposal_state(log.id)
        .call()
        .await
        .context("gov_contract.get_proposal_state")
        .unwrap_or(99); //default to Unknown

    let state = match proposal_state {
        0 => ProposalStateEnum::Pending,
        1 => ProposalStateEnum::Canceled,
        2 => ProposalStateEnum::Active,
        3 => ProposalStateEnum::Defeated,
        4 => ProposalStateEnum::Succeeded,
        5 => ProposalStateEnum::Queued,
        6 => ProposalStateEnum::Expired,
        7 => ProposalStateEnum::Executed,
        _ => ProposalStateEnum::Unknown,
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
        quorum: Set(quorum),
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

async fn get_title(hexhash: String) -> Result<String> {
    let mut retries = 0;
    let mut current_gateway = 0;
    let re = Regex::new(r"title:\s*(.*?)\n")?; // Move regex out of loop

    let gateways = [
        format!("https://cloudflare-ipfs.com/ipfs/f01701220{hexhash}"),
        format!("https://gateway.pinata.cloud/ipfs/f01701220{hexhash}"),
    ];

    loop {
        let response = reqwest::Client::new()
            .get(gateways[current_gateway].clone())
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) if res.status().is_success() => {
                // Check for any success status
                let text = res.text().await?;

                let mut title = String::from("");
                // Check if the text is JSON
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    title = json["title"].as_str().unwrap_or("Unknown").to_string();
                } else if let Some(captures) = re.captures(&text) {
                    // Fall back to regex if not JSON
                    if let Some(matched) = captures.get(1) {
                        title = matched.as_str().trim().to_string();
                    }
                }

                title = title.trim().to_string();

                if title.starts_with("# ") {
                    title = title.split_off(2).trim().to_string();
                }

                if title.starts_with('\"') {
                    title.remove(0);
                }

                if title.ends_with('\"') {
                    title.pop();
                }

                if title.is_empty() {
                    title = "Unknown".into()
                }

                return Ok(title);
            }
            Err(_) | Ok(_) => {
                // On any failure or non-success status, try next gateway
                current_gateway = (current_gateway + 1) % gateways.len();
            }
        }

        if retries < 12 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 12 retries
        }
    }
}

async fn get_discussion(hexhash: String) -> Result<String> {
    let mut retries = 0;
    let mut current_gateway = 0;
    let re = Regex::new(r"discussions:\s*(.*?)\n")?; // Move regex out of loop

    let gateways = [
        format!("https://cloudflare-ipfs.com/ipfs/f01701220{hexhash}"),
        format!("https://gateway.pinata.cloud/ipfs/f01701220{hexhash}"),
    ];

    loop {
        let response = reqwest::Client::new()
            .get(gateways[current_gateway].clone())
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) if res.status().is_success() => {
                // Check for any success status
                let text = res.text().await?;

                let mut discussions = String::from("");
                // Check if the text is JSON
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    discussions = json["discussions"]
                        .as_str()
                        .unwrap_or("Unknown")
                        .to_string();
                } else if let Some(captures) = re.captures(&text) {
                    // Fall back to regex if not JSON
                    if let Some(matched) = captures.get(1) {
                        discussions = matched.as_str().trim().to_string();
                    }
                }

                discussions = discussions.trim().to_string();

                if discussions.starts_with("# ") {
                    discussions = discussions.split_off(2).trim().to_string();
                }

                if discussions.starts_with('\"') {
                    discussions.remove(0);
                }

                if discussions.ends_with('\"') {
                    discussions.pop();
                }

                if discussions.is_empty() {
                    discussions = "Unknown".into()
                }

                return Ok(discussions);
            }
            Err(_) | Ok(_) => {
                // On any failure or non-success status, try next gateway
                current_gateway = (current_gateway + 1) % gateways.len();
            }
        }

        if retries < 12 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 12 retries
        }
    }
}

async fn get_body(hexhash: String) -> Result<String> {
    let mut retries = 0;
    let mut current_gateway = 0;

    let gateways = [
        format!("https://cloudflare-ipfs.com/ipfs/f01701220{hexhash}"),
        format!("https://gateway.pinata.cloud/ipfs/f01701220{hexhash}"),
    ];

    loop {
        let response = reqwest::Client::new()
            .get(gateways[current_gateway].clone())
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) if res.status().is_success() => {
                let body = res.text().await?;

                return Ok(body);
            }
            Err(_) | Ok(_) => {
                // On any failure or non-success status, try next gateway
                current_gateway = (current_gateway + 1) % gateways.len();
            }
        }

        if retries < 12 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 12 retries
        }
    }
}
