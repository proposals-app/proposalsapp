use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::aave_v_3_gov_mainnet::{aave_v3_gov_mainnet, ProposalCreatedFilter};
use ethers::{prelude::*, utils::hex};
use regex::Regex;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::{sync::Arc, time::Duration};

pub struct AaveV3Handler;

#[async_trait]
impl ProposalHandler for AaveV3Handler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
    ) -> Result<ProposalsResult> {
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

        let mut result = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, dao_handler, gov_contract.clone())
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
        0 => ProposalStateEnum::Unknown,
        1 => ProposalStateEnum::Pending,
        2 => ProposalStateEnum::Active,
        3 => ProposalStateEnum::Queued,
        4 => ProposalStateEnum::Executed,
        5 => ProposalStateEnum::Defeated,
        6 => ProposalStateEnum::Canceled,
        7 => ProposalStateEnum::Expired,
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
mod aave_v3 {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV2};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn aave_v3_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
            handler_type: (DaoHandlerEnumV2::AaveV3Mainnet),
            governance_portal: "https://app.aave.com/governance".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 18959200,
            votes_index: 0,
            dao_id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
            name: "Aave".into(),
            slug: "aave".into(),
            hot: true,
        };

        match AaveV3Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "1",
                    name: "Polygon V2 Reserve Factor Updates",
                    body_contains: vec!["This AIP is a continuation of AIP-284 and increases the Reserve Factor (RF) for assets on Polygon v2 by 5.00%, up to a maximum of 99.99%.","TokenLogic and karpatkey receive no compensation beyond Aave protocol for the creation of this proposal. TokenLogic and karpatkey are both delegates within the Aave ecosystem."],
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=1",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-reserve-factor-updates-polygon-aave-v2/13937",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[368222.2477753108,445.092704273313]",
                    scores_total: 368667.3404795841,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(18959200),
                    time_created: Some("2024-01-08 01:57:59"),
                    time_start: "2024-01-09 02:00:59",
                    time_end: "2024-01-12 02:00:59",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn aave_v3_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
            handler_type: (DaoHandlerEnumV2::AaveV3Mainnet),
            governance_portal: "https://app.aave.com/governance".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 19819808 - 19812127,
            votes_refresh_speed: 1,
            proposals_index: 19812127,
            votes_index: 0,
            dao_id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
            name: "Aave".into(),
            slug: "aave".into(),
            hot: true,
        };

        match AaveV3Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "100",
                    name: "Generalized LT/LTV Reductions on Aave V3 Step 2",
                    body_contains: vec!["Reduce stablecoin LTs and LTVs across all markets.","adjust DAI and sDAI risk parameters, it has been excluded from this proposal."],
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=100",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-generalized-lt-ltv-reductions-on-aave-v3-step-2-04-23-2024/17455",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[673483.6390054198,0.0]",
                    scores_total: 673483.6390054198,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(19812127),
                    time_created: Some("2024-05-06 16:07:11"),
                    time_start: "2024-05-07 16:07:47",
                    time_end: "2024-05-10 16:07:47",
                },
                ExpectedProposal {
                    external_id: "101",
                    name: "weETH Onbaording",
                    body_contains: vec!["The intention behind this initiative is to enhance the diversity of assets on Aave and bolster liquidity within the ecosystem."],
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=101",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-onboard-weeth-to-aave-v3-on-ethereum/16758",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[0.0,0.0]",
                    scores_total: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Canceled,
                    block_created: Some(19819808),
                    time_created: Some("2024-05-07 17:54:23"),
                    time_start: "1970-01-01 00:00:00",
                    time_end: "1970-01-01 00:00:00",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn aave_v3_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
            handler_type: (DaoHandlerEnumV2::AaveV3Mainnet),
            governance_portal: "https://app.aave.com/governance".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 19412601,
            votes_index: 0,
            dao_id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("9cbadfa8-5888-4922-a5e5-f9a999ae5c1a").unwrap(),
            name: "Aave".into(),
            slug: "aave".into(),
            hot: true,
        };

        match AaveV3Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "47",
                    name: "Activation of A-C Prime Foundation",
                    body_contains: vec!["giving mandate to Centrifuge to create a Association to represent the Aave DAO off-chain, this AIP proposes the activation of the A-C Prime Foundation.","References"],
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=47",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-aave-treasury-rwa-allocation/14790",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[69575.82853768951,425389.02729258186]",
                    scores_total: 494964.8558302714,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Defeated,
                    block_created: Some(19412601),
                    time_created: Some("2024-03-11 14:58:23"),
                    time_start: "2024-03-12 17:34:59",
                    time_end: "2024-03-15 17:34:59",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
