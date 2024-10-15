use crate::{indexer::Indexer, rpc_providers};
use alloy::{
    primitives::{address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use chrono::DateTime;
use regex::Regex;
use rust_decimal::prelude::ToPrimitive;
use scanners::etherscan::estimate_timestamp;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    dydx_gov,
    "./abis/dydx_gov.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    dydx_executor,
    "./abis/dydx_executor.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    dydx_strategy,
    "./abis/dydx_strategy.json"
);

pub struct DydxMainnetProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for DydxMainnetProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Dydx Proposals");

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

        let address = address!("7E9B1672616FF6D6629Ef2879419aaE79A9018D2");

        let gov_contract = dydx_gov::new(address, eth_rpc.clone());

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

        Ok((proposals, Vec::new(), new_index))
    }
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (dydx_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: dydx_gov::dydx_govInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let (event, log): (dydx_gov::ProposalCreated, Log) = p.clone();

    let created_block = rpc
        .get_block_by_number(log.block_number.unwrap().into(), false)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp =
        DateTime::from_timestamp(created_block.header.timestamp as i64, 0)
            .context("bad timestamp")?
            .naive_utc();

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
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

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
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

    let proposal_url = format!("https://dydx.community/dashboard/proposal/{}", event.id);

    let proposal_external_id = event.id.to_string();

    let executor_contract = dydx_executor::new(event.executor, rpc.clone());

    let strategy_contract = dydx_strategy::new(event.strategy, rpc.clone());

    let total_voting_power = strategy_contract
        .getTotalVotingSupplyAt(U256::from(log.block_number.unwrap()))
        .call()
        .await
        .context("strategy_contract.getTotalVotingSupplyAt")
        .map(|result| result._0)
        .unwrap_or(U256::from(0));

    let min_quorum = executor_contract
        .MINIMUM_QUORUM()
        .call()
        .await
        .context("executor_contract.MINIMUM_QUORUM")?
        ._0;

    let one_hunded_with_precision = executor_contract
        .ONE_HUNDRED_WITH_PRECISION()
        .call()
        .await
        .context("executor_contract.ONE_HUNDRED_WITH_PRECISION")?
        ._0;

    let quorum = ((total_voting_power * min_quorum) / one_hunded_with_precision).to::<u128>()
        as f64
        / (10.0f64.powi(18));

    let onchain_proposal = gov_contract
        .getProposalById(event.id)
        .call()
        .await
        .context("gov_contract.getProposalById")?
        ._0;

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18));

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
        .getProposalState(event.id)
        .call()
        .await
        .context("gov_contract.getProposalState")
        .map(|result| result._0)
        .unwrap_or(99); //default to Unknown

    let state = match proposal_state {
        0 => ProposalState::Pending,
        1 => ProposalState::Canceled,
        2 => ProposalState::Active,
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
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: Set(discussionurl),
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(scores_quorum),
        quorum: Set(quorum),
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
            return Ok("Unknown".to_string()); // Exit after 12 retries
        }
    }
}

#[cfg(test)]
mod dydx_mainnet_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn dydx_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 13628320,
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

        match DydxMainnetProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 13628320,
                    external_id: "4",
                    name: "Upgrade the StarkProxy smart contract",
                    body_contains: Some(vec!["Upgrade StarkProxy smart contracts to support deposit cancellation and recovery."]),
                    url: "https://dydx.community/dashboard/proposal/4",
                    discussion_url: "https://forums.dydx.community/proposal/discussion/2437-drc-smart-contract-upgrade-for-market-maker-borrowers-from-liquidity-staking-pool/",
                    choices: json!(["For", "Against"]),
                    scores: json!([69606482.29966135, 0.0]),
                    scores_total: 69606482.29966135,
                    scores_quorum: 69606482.29966135,
                    quorum: 20000000.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2021-11-16 19:03:13"),
                    time_start: parse_datetime("2021-11-17 19:36:19"),
                    time_end: parse_datetime("2021-11-21 23:51:38"),
                    block_created: Some(13628320),
                    txid: Some("0xd4a22490da1b095a5418186fd82268242fde6f231272ce038e03a5b27e539898"),
                    metadata: None,
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn dydx_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::DydxMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 17477983 - 17076736,
            index: 17076736,
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

        match DydxMainnetProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [
                    ExpectedProposal {
                        index_created: 17076736,
                        external_id: "12",
                        name: "Increase Maximum Funding Rates (8h) to 4% and Fix Data Bug in the V3 Perp Contract",
                        body_contains: Some(vec!["Increase the maximum 8h funding rate from 0.75% to 4% across all markets, and deploy a fix to the relevant dYdX V3 perpetual smart contracts to fix a data availability issue. Due to efficiencies on testing and deployment with recommendation from the Starkware team, the changes from these 2 separate proposals are bundled into one single on-chain DIP for implementation."]),
                        url: "https://dydx.community/dashboard/proposal/12",
                        discussion_url: "https://commonwealth.im/dydx/discussion/10234-drc-increase-the-maximum-funding-rate & https://commonwealth.im/dydx/discussion/10634-v3-starkware-contract-data-availability-bug",
                        choices: json!(["For", "Against"]),
                        scores: json!([78580770.00636643, 682.59]),
                        scores_total: 78581452.59636644,
                        scores_quorum: 78580770.00636643,
                        quorum: 20000000.0,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2023-04-18 23:13:35"),
                        time_start: parse_datetime("2023-04-19 21:28:35"),
                        time_end: parse_datetime("2023-04-23 14:23:59"),
                        block_created: Some(17076736),
                        txid: Some("0x193769203351daa7184463744f130c39ee0df05e6a711e2a5905e79ebe72aba7"),
                        metadata: None,
                    },
                    ExpectedProposal {
                        index_created: 17477983,
                        external_id: "13",
                        name: "Launch the dYdX Operations subDAO V2",
                        body_contains: Some(vec!["Important Notice: This proposal is being sponsored by Wintermute Governance’s DYDX proposal/voting power on behalf of the dYdX Operations Trust."]),
                        url: "https://dydx.community/dashboard/proposal/13",
                        discussion_url: "https://dydx.forum/t/dydx-operations-subdao-v2/274",
                        choices: json!(["For", "Against"]),
                        scores: json!([73712919.43043149, 1002.9911152402094]),
                        scores_total: 73713922.42154673,
                        scores_quorum: 73712919.43043149,
                        quorum: 20000000.0,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2023-06-14 11:48:35"),
                        time_start: parse_datetime("2023-06-15 10:00:23"),
                        time_end: parse_datetime("2023-06-19 02:30:47"),
                        block_created: Some(17477983),
                        txid: Some("0xdde79a41786a5331830cba25c50c3e8eef166c4913e72939c8d7116702db9bcf"),
                        metadata: None,
                    }
                ];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
