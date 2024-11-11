use crate::{
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
    rpc_providers,
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use regex::Regex;
use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    aave_v3_gov,
    "./abis/aave_v3_gov_mainnet.json"
);

pub struct AaveV3MainnetProposalsIndexer;

#[async_trait]
impl Indexer for AaveV3MainnetProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

#[async_trait]
impl ProposalsIndexer for AaveV3MainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Aave V3 Mainnet Proposals");

        let eth_rpc = rpc_providers::get_provider("ethereum")?;

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

        let address = address!("9AEE0B04504CeF83A65AC3f0e838D0593BCb2BC7");

        let gov_contract = aave_v3_gov::new(address, eth_rpc.clone());

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
            let p = data_for_proposal(p.clone(), indexer, gov_contract.clone())
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
    p: (aave_v3_gov::ProposalCreated, Log),
    indexer: &dao_indexer::Model,
    gov_contract: aave_v3_gov::aave_v3_govInstance<Http<Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let (event, log): (aave_v3_gov::ProposalCreated, Log) = p.clone();

    let onchain_proposal = gov_contract
        .getProposal(event.proposalId)
        .call()
        .await
        .context("gov_contract.getProposal")?
        ._0;

    let created_block_timestamp = DateTime::from_timestamp_millis(
        (onchain_proposal.creationTime.to::<u64>() * 1000)
            .try_into()
            .unwrap(),
    )
    .context("bad timestamp")?
    .naive_utc();

    let voting_starts_timestamp = DateTime::from_timestamp_millis(
        (onchain_proposal.votingActivationTime.to::<u64>() * 1000)
            .try_into()
            .unwrap(),
    )
    .context("bad timestamp")?
    .naive_utc();

    let voting_ends_timestamp = DateTime::from_timestamp_millis(
        ((onchain_proposal.votingActivationTime.to::<u64>()
            + onchain_proposal.votingDuration.to::<u64>())
            * 1000)
            .try_into()
            .unwrap(),
    )
    .context("bad timestamp")?
    .naive_utc();

    let proposal_url = format!(
        "https://app.aave.com/governance/v3/proposal/?proposalId={}",
        event.proposalId
    );

    let proposal_external_id = event.proposalId.to_string();

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.forVotes as f64 / (10.0f64.powi(18)),
        onchain_proposal.againstVotes as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let voting_config = gov_contract
        .getVotingConfig(event.accessLevel)
        .call()
        .await
        .context("gov_contract.getVotingConfig")?
        ._0;

    let quorum = voting_config.yesThreshold.to::<u128>() as f64;

    let scores_quorum = onchain_proposal.forVotes as f64 / (10.0f64.powi(18));

    let hash: Vec<u8> = event.ipfsHash.to_vec();

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
        .getProposalState(event.proposalId)
        .call()
        .await
        .context("getProposalState")
        .map(|result| result._0)
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
        marked_spam: NotSet,
        block_created: Set(Some(log.block_number.unwrap().to_i32().unwrap())),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(log.block_number.unwrap().to_i32().unwrap()),
        metadata: NotSet,
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

async fn get_title(hexhash: String) -> Result<String> {
    let mut retries = 0;
    let mut current_gateway = 0;
    let re = Regex::new(r"title:\s*(.*?)\n")?; // Move regex out of loop

    let gateways = [
        format!("https://ipfs.proposals.app/ipfs/f01701220{hexhash}"),
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
        format!("https://ipfs.proposals.app/ipfs/f01701220{hexhash}"),
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
        format!("https://ipfs.proposals.app/ipfs/f01701220{hexhash}"),
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

#[cfg(test)]
mod aave_v3_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn aave_v3_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV3MainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 18959200,
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

        match AaveV3MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 18959200,
                    external_id: "1",
                    name: "Polygon V2 Reserve Factor Updates",
                    body_contains: Some(vec!["This AIP is a continuation of AIP-284 and increases the Reserve Factor (RF) for assets on Polygon v2 by 5.00%, up to a maximum of 99.99%.","TokenLogic and karpatkey receive no compensation beyond Aave protocol for the creation of this proposal. TokenLogic and karpatkey are both delegates within the Aave ecosystem."]),
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=1",
                    discussion_url: "https://governance.aave.com/t/arfc-reserve-factor-updates-polygon-aave-v2/13937",
                    choices: json!(["For", "Against"]),
                    scores: json!([368222.2477753108, 445.092704273313]),
                    scores_total: 368667.3404795841,
                    scores_quorum: 368222.2477753108,
                    quorum: 320000.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-01-08 01:57:59"),
                    time_start: parse_datetime("2024-01-09 02:00:59"),
                    time_end: parse_datetime("2024-01-12 02:00:59"),
                    block_created: Some(18959200),
                    txid: Some("0xd5c3f2e3879fe7b5429df9068877cf41d3e18eeca7a064ce8ba7399bacc86d5d"),
                    metadata: None,
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn aave_v3_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV3MainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 19819808 - 19812127,
            index: 19812127,
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

        match AaveV3MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [
                    ExpectedProposal {
                        index_created: 19812127,
                        external_id: "100",
                        name: "Generalized LT/LTV Reductions on Aave V3 Step 2",
                        body_contains: Some(vec!["Reduce stablecoin LTs and LTVs across all markets.","adjust DAI and sDAI risk parameters, it has been excluded from this proposal."]),
                        url: "https://app.aave.com/governance/v3/proposal/?proposalId=100",
                        discussion_url: "https://governance.aave.com/t/arfc-generalized-lt-ltv-reductions-on-aave-v3-step-2-04-23-2024/17455",
                        choices: json!(["For", "Against"]),
                        scores: json!([673483.6390054198, 0.0]),
                        scores_total: 673483.6390054198,
                        scores_quorum: 673483.6390054198,
                        quorum: 320000.0,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2024-05-06 16:07:11"),
                        time_start: parse_datetime("2024-05-07 16:07:47"),
                        time_end: parse_datetime("2024-05-10 16:07:47"),
                        block_created: Some(19812127),
                        txid: Some("0xb45582da92bbd8b471871655b15142482e9233ef5edabd88f57ffe82287f43b2"),
                        metadata: None,
                    },
                    ExpectedProposal {
                        index_created: 19819808,
                        external_id: "101",
                        name: "weETH Onbaording",
                        body_contains: Some(vec!["The intention behind this initiative is to enhance the diversity of assets on Aave and bolster liquidity within the ecosystem."]),
                        url: "https://app.aave.com/governance/v3/proposal/?proposalId=101",
                        discussion_url: "https://governance.aave.com/t/arfc-onboard-weeth-to-aave-v3-on-ethereum/16758",
                        choices: json!(["For", "Against"]),
                        scores: json!([0.0, 0.0]),
                        scores_total: 0.0,
                        scores_quorum: 0.0,
                        quorum: 320000.0,
                        proposal_state: ProposalState::Canceled,
                        marked_spam: None,
                        time_created: parse_datetime("2024-05-07 17:54:23"),
                        time_start: parse_datetime("1970-01-01 00:00:00"),
                        time_end: parse_datetime("1970-01-01 00:00:00"),
                        block_created: Some(19819808),
                        txid: Some("0x9ec89471c1272a72e14db68ee2813f81eeb403a384c24ad79d3efe18d2f105b6"),
                        metadata: None,
                    }
                ];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn aave_v3_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV3MainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 19412601,
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

        match AaveV3MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 19412601,
                    external_id: "47",
                    name: "Activation of A-C Prime Foundation",
                    body_contains: Some(vec!["giving mandate to Centrifuge to create a Association to represent the Aave DAO off-chain, this AIP proposes the activation of the A-C Prime Foundation.","References"]),
                    url: "https://app.aave.com/governance/v3/proposal/?proposalId=47",
                    discussion_url: "https://governance.aave.com/t/arfc-aave-treasury-rwa-allocation/14790",
                    choices: json!(["For", "Against"]),
                    scores: json!([69575.82853768951, 425389.02729258186]),
                    scores_total: 494964.8558302714,
                    scores_quorum: 69575.82853768951,
                    quorum: 320000.0,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2024-03-11 14:58:23"),
                    time_start: parse_datetime("2024-03-12 17:34:59"),
                    time_end: parse_datetime("2024-03-15 17:34:59"),
                    block_created: Some(19412601),
                    txid: Some("0xfa2a20615e1ff91d9fcb4cd4f5dd5488f41ec6b762d0e9ebbc9b04038db1bb37"),
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
