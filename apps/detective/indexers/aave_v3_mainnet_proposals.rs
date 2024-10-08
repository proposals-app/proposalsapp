use crate::indexer::Indexer;
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use contracts::gen::aave_v_3_gov_mainnet::{aave_v3_gov_mainnet, ProposalCreatedFilter};
use ethers::{
    abi::Address,
    contract::LogMeta,
    providers::{Http, Middleware, Provider},
};
use regex::Regex;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::info;

pub struct AaveV3MainnetProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for AaveV3MainnetProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Aave V3 Mainnet Proposals");

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

        let address = "0x9AEE0B04504CeF83A65AC3f0e838D0593BCb2BC7"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = aave_v3_gov_mainnet::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .proposal_created_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, indexer, gov_contract.clone())
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
    p: (
        contracts::gen::aave_v_3_gov_mainnet::ProposalCreatedFilter,
        LogMeta,
    ),
    _rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
    gov_contract: aave_v3_gov_mainnet<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();

    let onchain_proposal = gov_contract
        .get_proposal(log.proposal_id)
        .call()
        .await
        .context("gov_contract.get_proposal")?;

    #[allow(deprecated)]
    let created_block_timestamp = NaiveDateTime::from_timestamp_millis(
        (onchain_proposal.creation_time * 1000).try_into().unwrap(),
    )
    .context("bad timestamp")?;

    #[allow(deprecated)]
    let voting_starts_timestamp = NaiveDateTime::from_timestamp_millis(
        (onchain_proposal.voting_activation_time * 1000)
            .try_into()
            .unwrap(),
    )
    .context("bad timestamp")?;

    #[allow(deprecated)]
    let voting_ends_timestamp = NaiveDateTime::from_timestamp_millis(
        ((onchain_proposal.voting_activation_time + onchain_proposal.voting_duration as u64)
            * 1000)
            .try_into()
            .unwrap(),
    )
    .context("bad timestamp")?;

    let proposal_url = format!(
        "https://app.aave.com/governance/v3/proposal/?proposalId={}",
        log.proposal_id
    );

    let proposal_external_id = log.proposal_id.to_string();

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.for_votes as f64 / (10.0f64.powi(18)),
        onchain_proposal.against_votes as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let voting_config = gov_contract
        .get_voting_config(log.access_level)
        .call()
        .await
        .context("gov_contract.get_voting_config")?;

    let quorum = voting_config.yes_threshold as f64;

    let scores_quorum = onchain_proposal.for_votes as f64 / (10.0f64.powi(18));

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
        .get_proposal_state(log.proposal_id)
        .await
        .context("gov_contract.get_proposal_state")
        .unwrap_or(99); //default to Unknown

    let state = match proposal_state {
        0 => ProposalState::Unknown,
        1 => ProposalState::Pending,
        2 => ProposalState::Active,
        3 => ProposalState::Queued,
        4 => ProposalState::Executed,
        5 => ProposalState::Defeated,
        6 => ProposalState::Canceled,
        7 => ProposalState::Expired,
        _ => ProposalState::Unknown,
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
        scores_quorum: Set(scores_quorum),
        proposal_state: Set(state),
        flagged_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        metadata: NotSet,
        txid: Set(Some(format!("{:#x}", meta.transaction_hash))),
        snapshot_votes_fetched: NotSet,
    })
}

async fn get_title(hexhash: String) -> Result<String> {
    let mut retries = 0;
    let mut current_gateway = 0;
    let re = Regex::new(r"title:\s*(.*?)\n")?; // Move regex out of loop

    let gateways = [
        format!("http://proposalsapp-ipfs:8080/ipfs/f01701220{hexhash}"),
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
        format!("http://proposalsapp-ipfs:8080/ipfs/f01701220{hexhash}"),
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
        format!("http://proposalsapp-ipfs:8080/ipfs/f01701220{hexhash}"),
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
            return Ok("Unknown".to_string());
        }
    }
}
