use crate::ProposalHandler;
use crate::ProposalsResult;
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::aave_v_3_gov_mainnet::aave_v3_gov_mainnet;
use contracts::gen::aave_v_3_gov_mainnet::ProposalCreatedFilter;
use ethers::prelude::*;
use ethers::utils::hex;
use regex::Regex;
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

pub struct AaveV3Handler;

#[async_trait]
impl ProposalHandler for AaveV3Handler {
    async fn get_proposals(&self, dao_handler: &dao_handler::Model) -> Result<ProposalsResult> {
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

        let gov_contract = aave_v3_gov_mainnet::new(address, eth_rpc.clone());

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

        Ok(ProposalsResult {
            proposals: result,
            to_index: Some(to_block as i32),
        })
    }

    fn min_refresh_speed(&self) -> i32 {
        100
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
    decoder: &Decoder,
    dao_handler: &dao_handler::Model,
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

    let proposal_url = format!("{}{}", decoder.proposalUrl, log.proposal_id);

    let proposal_external_id = log.proposal_id.to_string();

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.for_votes as f64 / (10.0f64.powi(18)),
        onchain_proposal.against_votes as f64 / (10.0f64.powi(18)),
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
        .get_proposal_state(log.proposal_id)
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
        quorum: Set(0.into()),
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

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Context;
    use dotenv::dotenv;
    use sea_orm::{
        ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    };
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnum};

    #[tokio::test]
    async fn test_get_proposals() {
        let _ = dotenv();

        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL not set")
            .unwrap();

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .context("Failed to connect to database")
            .unwrap();

        let mut dao_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnum::AaveV3Mainnet))
            .one(&db)
            .await
            .context("Failed to query DAO handler")
            .unwrap()
            .context("DAO handler not found")
            .unwrap();

        // Update proposals index to the specified block number
        dao_handler.proposals_index = 19762955;
        dao_handler.proposals_refresh_speed = 1;

        // Call the get_proposals method
        match AaveV3Handler.get_proposals(&dao_handler).await {
            Ok(result) => {
                // Assertions to verify the result
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                for proposal in result.proposals {
                    assert_eq!(
                        proposal.clone().external_id.take().unwrap(),
                        "93",
                        "Proposal id does not match"
                    );
                    assert_eq!(
                        proposal.clone().name.take().unwrap(),
                        "aAMPL Second Distribution",
                        "Proposal name does not match"
                    );
                    assert!(
                        proposal
                            .clone()
                            .body
                            .take()
                            .unwrap()
                            .contains("aAMPL Second Distribution"),
                        "Proposal body does not match"
                    );
                    assert!(
                        proposal.clone().scores_total.take().unwrap() >= 0.0,
                        "Invalid scores total"
                    );
                    assert_eq!(
                        proposal.clone().url.take().unwrap(),
                        "https://app.aave.com/governance/v3/proposal/?proposalId=93",
                        "Proposal URL does not match"
                    );
                    assert_eq!(
                        proposal.clone().discussion_url.take().unwrap(),
                        "https://governance.aave.com/t/arfc-aampl-second-distribution/17464",
                        "Discussion URL does not match"
                    );
                    assert_eq!(
                        proposal.clone().choices.take().unwrap().to_string(),
                        "[\"For\",\"Against\"]",
                        "Choices do not match"
                    );
                    assert_eq!(
                        proposal.clone().scores.take().unwrap().to_string(),
                        "[541463.9945180276,0.0]",
                        "Scores do not match"
                    );
                    assert_eq!(
                        proposal.clone().scores_total.take().unwrap(),
                        541463.9945180276,
                        "Scores total does not match"
                    );
                    assert_eq!(
                        proposal.clone().proposal_state.take().unwrap(),
                        ProposalStateEnum::Succeeded,
                        "Proposal state does not match"
                    );
                    assert_eq!(
                        proposal.clone().block_created.take().unwrap().unwrap(),
                        19762955,
                        "Block created does not match"
                    );

                    if let Some(time_created) = proposal.clone().time_created.take().unwrap() {
                        let expected_time_created = NaiveDateTime::parse_from_str(
                            "2024-04-29 19:08:47",
                            "%Y-%m-%d %H:%M:%S",
                        )
                        .unwrap();
                        assert_eq!(
                            time_created, expected_time_created,
                            "Time created does not match"
                        );
                    } else {
                        panic!("Time created is None");
                    }

                    if let Some(time_start) = proposal.clone().time_start.take() {
                        let expected_time_start = NaiveDateTime::parse_from_str(
                            "2024-04-30 19:09:11",
                            "%Y-%m-%d %H:%M:%S",
                        )
                        .unwrap();
                        assert_eq!(
                            time_start, expected_time_start,
                            "Time created does not match"
                        );
                    } else {
                        panic!("Time created is None");
                    }

                    if let Some(time_end) = proposal.clone().time_end.take() {
                        let expected_time_end = NaiveDateTime::parse_from_str(
                            "2024-05-03 19:09:11",
                            "%Y-%m-%d %H:%M:%S",
                        )
                        .unwrap();
                        assert_eq!(time_end, expected_time_end, "Time created does not match");
                    } else {
                        panic!("Time created is None");
                    }

                    assert_eq!(
                        proposal.clone().dao_handler_id.take().unwrap(),
                        dao_handler.id,
                        "DAO handler ID does not match"
                    );

                    assert_eq!(
                        proposal.clone().dao_id.take().unwrap(),
                        dao_handler.dao_id,
                        "DAO handler ID does not match"
                    );
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
