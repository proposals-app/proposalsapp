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
    use chrono::NaiveDateTime;
    use dotenv::dotenv;
    use sea_orm::{
        prelude::Uuid, ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait,
        QueryFilter,
    };
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnum};

    async fn setup_database() -> DatabaseConnection {
        dotenv().ok();

        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL not set")
            .unwrap();

        let mut opt = ConnectOptions::new(database_url);
        opt.sqlx_logging(false);

        Database::connect(opt)
            .await
            .context("Failed to connect to database")
            .unwrap()
    }

    async fn get_dao_handler(db: &DatabaseConnection) -> dao_handler::Model {
        dao_handler::Entity::find()
            .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnum::AaveV3Mainnet))
            .one(db)
            .await
            .context("Failed to query DAO handler")
            .unwrap()
            .context("DAO handler not found")
            .unwrap()
    }

    struct ExpectedProposal {
        external_id: &'static str,
        name: &'static str,
        body: &'static str,
        url: &'static str,
        discussion_url: &'static str,
        choices: &'static str,
        scores: &'static str,
        scores_total: f64,
        proposal_state: ProposalStateEnum,
        block_created: Option<i32>,
        time_created: Option<&'static str>,
        time_start: &'static str,
        time_end: &'static str,
    }

    fn assert_proposal(
        proposal: &proposal::ActiveModel,
        expected: &ExpectedProposal,
        dao_handler_id: Uuid,
        dao_id: Uuid,
    ) {
        assert_eq!(
            proposal.external_id.clone().take().unwrap(),
            expected.external_id,
            "Proposal id does not match"
        );
        assert_eq!(
            proposal.name.clone().take().unwrap(),
            expected.name,
            "Proposal name does not match"
        );
        assert!(
            proposal
                .body
                .clone()
                .take()
                .unwrap()
                .contains(expected.body),
            "Proposal body does not match"
        );
        assert!(
            proposal.scores_total.clone().take().unwrap() >= 0.0,
            "Invalid scores total"
        );
        assert_eq!(
            proposal.url.clone().take().unwrap(),
            expected.url,
            "Proposal URL does not match"
        );
        assert_eq!(
            proposal.discussion_url.clone().take().unwrap(),
            expected.discussion_url,
            "Discussion URL does not match"
        );

        let choices_json = proposal.choices.clone().take().unwrap().to_string();
        assert_eq!(choices_json, expected.choices, "Choices do not match");

        let scores_json = (proposal.scores.clone().take().unwrap().to_string());
        assert_eq!(scores_json, expected.scores, "Scores do not match");

        assert_eq!(
            proposal.scores_total.clone().take().unwrap(),
            expected.scores_total,
            "Scores total does not match"
        );
        assert_eq!(
            proposal.proposal_state.clone().take().unwrap(),
            expected.proposal_state,
            "Proposal state does not match"
        );
        assert_eq!(
            proposal.block_created.clone().take().unwrap(),
            expected.block_created,
            "Block created does not match"
        );

        if let Some(time_created_str) = expected.time_created {
            let expected_time_created =
                NaiveDateTime::parse_from_str(time_created_str, "%Y-%m-%d %H:%M:%S").unwrap();
            assert_eq!(
                proposal.time_created.clone().take().unwrap(),
                Some(expected_time_created),
                "Time created does not match"
            );
        }

        let expected_time_start =
            NaiveDateTime::parse_from_str(expected.time_start, "%Y-%m-%d %H:%M:%S").unwrap();
        assert_eq!(
            proposal.time_start.clone().take().unwrap(),
            expected_time_start,
            "Time start does not match"
        );

        let expected_time_end =
            NaiveDateTime::parse_from_str(expected.time_end, "%Y-%m-%d %H:%M:%S").unwrap();
        assert_eq!(
            proposal.time_end.clone().take().unwrap(),
            expected_time_end,
            "Time end does not match"
        );

        assert_eq!(
            proposal.dao_handler_id.clone().take().unwrap(),
            dao_handler_id,
            "DAO handler ID does not match"
        );

        assert_eq!(
            proposal.dao_id.clone().take().unwrap(),
            dao_id,
            "DAO ID does not match"
        );
    }

    #[tokio::test]
    async fn test_get_proposals() {
        let db = setup_database().await;
        let mut dao_handler = get_dao_handler(&db).await;

        dao_handler.proposals_index = 19762955;
        dao_handler.proposals_refresh_speed = 1;

        match AaveV3Handler.get_proposals(&dao_handler).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = vec![ExpectedProposal {
                    external_id: "93",
                    name: "aAMPL Second Distribution",
                    body: "aAMPL Second Distribution",
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=93",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-aampl-second-distribution/17464",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[541463.9945180276,0.0]",
                    scores_total: 541463.9945180276,
                    proposal_state: ProposalStateEnum::Succeeded,
                    block_created: Some(19762955),
                    time_created: Some("2024-04-29 19:08:47"),
                    time_start: "2024-04-30 19:09:11",
                    time_end: "2024-05-03 19:09:11",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
