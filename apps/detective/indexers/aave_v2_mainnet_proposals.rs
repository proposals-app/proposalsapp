use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
use aave_v2_gov::{aave_v2_govInstance, ProposalCreated};
use alloy::{
    primitives::{address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
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
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    aave_v2_gov,
    "./abis/aave_v2_gov.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    aave_v2_executor,
    "./abis/aave_v2_executor.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    aave_v2_strategy,
    "./abis/aave_v2_strategy.json"
);

pub struct AaveV2MainnetProposalsIndexer;

#[async_trait]
impl Indexer for AaveV2MainnetProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::AaveV2MainnetProposals
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for AaveV2MainnetProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Aave V2 Mainnet Proposals");

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

        let address = address!("EC568fffba86c094cf06b22134B23074DFE2252c");

        let gov_contract = aave_v2_gov::new(address, eth_rpc.clone());

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

        Ok(ProcessResult::Proposals(proposals, new_index))
    }
}

async fn data_for_proposal(
    p: (ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: aave_v2_govInstance<Http<Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let (event, log): (ProposalCreated, Log) = p.clone();

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let created_block_timestamp = rpc
        .get_block_by_number(
            log.block_number.unwrap().into(),
            BlockTransactionsKind::Hashes,
        )
        .await
        .context("get_block_by_number")?
        .unwrap()
        .header
        .timestamp;

    let created_block_timestamp =
        DateTime::from_timestamp_millis(created_block_timestamp as i64 * 1000)
            .unwrap()
            .naive_utc();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Ethereum, voting_start_block_number).await {
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

    let voting_ends_timestamp =
        match chain_data::estimate_timestamp(Chain::Ethereum, voting_end_block_number).await {
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

    let proposal_url = format!(
        "https://app.aave.com/governance/proposal/?proposalId={}",
        event.id
    );

    let proposal_external_id = event.id.to_string();

    let strategy_contract = aave_v2_strategy::new(event.strategy, rpc.clone());
    let executor_contract = aave_v2_executor::new(event.executor, rpc.clone());

    let total_voting_power = strategy_contract
        .getTotalVotingSupplyAt(U256::from(log.block_number.unwrap()))
        .call()
        .await
        .context("getTotalVotingSupplyAt")
        .map(|result| result._0)
        .unwrap_or(U256::from(0));

    let min_quorum = executor_contract
        .MINIMUM_QUORUM()
        .call()
        .await
        .context("MINIMUM_QUORUM")?
        ._0;

    let one_hundred_with_precision = executor_contract
        .ONE_HUNDRED_WITH_PRECISION()
        .call()
        .await
        .context("ONE_HUNDRED_WITH_PRECISION")?
        ._0;

    let quorum = ((total_voting_power * min_quorum) / one_hundred_with_precision).to::<u128>()
        as f64
        / (10.0f64.powi(18));

    let onchain_proposal = gov_contract
        .getProposalById(event.id)
        .call()
        .await
        .context("getProposalById")?
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
    let discussionurl = get_discussion(hex::encode(hash)).await;

    let proposal_state = gov_contract
        .getProposalState(event.id)
        .call()
        .await
        .context("getProposalState")
        .map(|result| result._0)
        .unwrap_or_else(|_| {
            if onchain_proposal.executed {
                7
            } else if onchain_proposal.canceled {
                1
            } else {
                99
            }
        }); //default to Unknown

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
        author: Set(Some(event.creator.to_string())),
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
        metadata: Set(json!({"vote_type": "single-choice", "quorum_choices":[0]}).into()),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

async fn get_title(hexhash: String) -> Result<String> {
    let mut retries = 0;
    let mut current_gateway = 0;
    let re = Regex::new(r"title:\s*(.*?)\n")?;

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

        if retries < 5 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 5 retries
        }
    }
}

async fn get_discussion(hexhash: String) -> Option<String> {
    let mut retries = 0;
    let mut current_gateway = 0;
    let re = Regex::new(r"discussions:\s*(.*?)\n").expect("Invalid regex pattern");

    let gateways = [
        format!("https://ipfs.proposals.app/ipfs/f01701220{hexhash}"),
        format!("https://cloudflare-ipfs.com/ipfs/f01701220{hexhash}"),
        format!("https://gateway.pinata.cloud/ipfs/f01701220{hexhash}"),
    ];

    while retries < 5 {
        let response = reqwest::Client::new()
            .get(gateways[current_gateway].clone())
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(res) if res.status().is_success() => {
                let text = res.text().await.expect("Failed to read response body");

                // Check if the text is JSON
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(discussions) = json["discussions"].as_str() {
                        return Some(discussions.trim().to_string());
                    }
                } else if let Some(captures) = re.captures(&text) {
                    // Fall back to regex if not JSON
                    if let Some(matched) = captures.get(1) {
                        let mut discussions = matched.as_str().trim().to_string();
                        if discussions.starts_with('\"') {
                            discussions.remove(0);
                        }
                        if discussions.ends_with('\"') {
                            discussions.pop();
                        }
                        return Some(discussions);
                    }
                }
            }
            _ => {}
        }

        current_gateway = (current_gateway + 1) % gateways.len();
        retries += 1;
        let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
        tokio::time::sleep(backoff_duration).await;
    }

    None
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

        if retries < 5 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 5 retries
        }
    }
}

#[cfg(test)]
mod aave_v2_content {
    use crate::indexers::aave_v2_mainnet_proposals::{get_body, get_discussion, get_title};

    #[tokio::test]
    async fn get_markdown_title() {
        assert_eq!(
            get_title("f76d79693a81a1c0acd23c6ee151369752142b0d832daeaef9a4dd9f8c4bc7ce".into())
                .await
                .unwrap(),
            "Polygon Supply Cap Update"
        );

        assert_eq!(
            get_title("e7e93497d3847536f07fe8dba53485cf68a275c7b07ca38b53d2cc2d43fab3b0".into())
                .await
                .unwrap(),
            "Unknown"
        );

        assert_eq!(get_title("deadbeef".into()).await.unwrap(), "Unknown");
    }

    #[tokio::test]
    async fn get_json_title() {
        assert_eq!(
            get_title("8d4f6f42043d8db567d5e733762bb84a6f507997a779a66b2d17fdf9de403c13".into())
                .await
                .unwrap(),
            "Add rETH to Arbitrum Aave v3"
        );

        assert_eq!(get_title("deadbeef".into()).await.unwrap(), "Unknown");
    }

    #[tokio::test]
    async fn get_markdown_discussionurl() {
        assert_eq!(
            get_discussion(
                "f76d79693a81a1c0acd23c6ee151369752142b0d832daeaef9a4dd9f8c4bc7ce".into()
            )
            .await,
            Some(
                "https://governance.aave.com/t/arfc-polygon-v3-supply-cap-update-2023-05-21/13161"
                    .to_string()
            )
        );

        assert_eq!(
            get_discussion(
                "e7e93497d3847536f07fe8dba53485cf68a275c7b07ca38b53d2cc2d43fab3b0".into()
            )
            .await,
            None
        );

        assert_eq!(get_discussion("deadbeef".into()).await, None);
    }

    #[tokio::test]
    async fn get_json_discussionurl() {
        assert_eq!(
            get_discussion(
                "8d4f6f42043d8db567d5e733762bb84a6f507997a779a66b2d17fdf9de403c13".into()
            )
            .await,
            Some("https://governance.aave.com/t/arfc-add-reth-to-aave-v3-arbitrum-liquidity-pool/12810".to_string())
        );

        assert_eq!(get_discussion("deadbeef".into()).await, None);
    }

    #[tokio::test]
    async fn get_markdown_body() {
        assert_eq!(
            get_body("f76d79693a81a1c0acd23c6ee151369752142b0d832daeaef9a4dd9f8c4bc7ce".into())
                .await
                .unwrap(),
            "---\ntitle: Polygon Supply Cap Update\ndiscussions: https://governance.aave.com/t/arfc-polygon-v3-supply-cap-update-2023-05-21/13161\nshortDescription: Increase SupplyCap stMATIC and MaticX on Polygon v3 from 30M units to 40M units and 29.3M to 38M units respectively.\nauthor: Llama (Fermin Carranza and TokenLogic)\ncreated: 2023-06-08\n---\n\n# Summary\n\nThis AIP increases the stMATIC and MaticX Supply Cap on Polygon to 40M units and 38M units respectively.\n\n# Abstract\n\nThe utilisation of the stMATIC and MaticX Supply Caps has reached 100% and is preventing strategies built on Aave Protocol from depositing into these reserves.\n\nThe yield maximising strategy is current incentivised by two communities, Polygon Foundation and Stader Labs. These incentives encourage users to deposit either Liquid Staking Token (LST) into Aave v3 Protocl.\n\nThis AIP, with support from Chaos Labs and a favourable Snapshot, shall increase the Supply Caps to enable users to deposit funds in the stMATIC and MaticX reserves on Polygon v3.\n\n# Motivation\n\nOver the previous months, Llama has been working with various communities to craft favourable conditions on Aave v3 Polygon to facilitate the creation of several yield aggregation products. These products are now active with more soon to be deployed.\n\nWith conservative Supply Caps being implemented and filled within minutes, or hours, communities who have built products on Aave v3 are experiencing great frustration. After investing time, resources and incurring audit costs, these communities are unable to promote their products to prospective users without the newly implemented Supply Caps being filled.\n\nFor these integrations to be successful, the Supply Caps need to be increased such that a wide array of prospective users can enter into these automated strategies. Currently, the smaller Supply Cap increases are filling quickly and we are experiencing several whales / products absoring near 100% of newly implemented Supply Caps is not promoting a desirable UX for users.\n\nThe original ARFC links below:\n\n- [MaticX Forum Post](https://governance.aave.com/t/arfc-polygon-supply-cap-update-23-05-2023/13190)\n- [stMATIC Forum Post](https://governance.aave.com/t/arfc-polygon-v3-supply-cap-update-2023-05-21/13161)\n\nThe proposed Supply Caps are supported by Chaos Labs. However, Gauntlet has a more conservative risk model which limits the Supply Cap to 50% of supply on the network relative to Chaose Lab's 75%. This difference leads to differing Supply Cap recommendations. Do note, Aave DAO voted to increase the Supply Caps to [75%](https://snapshot.org/#/aave.eth/proposal/0xf9261916c696ce2d793af41b7fe556896ed1ff7a8330b7d0489d5567ebefe3ba) of supply. A Snapshot vote for each Supply Cap is linked below:\n\n- [MaticX Snapshot](https://snapshot.org/#/aave.eth/proposal/0xbbb92805d7b15d46d668cdc8e40d9a15e6a3ed2ac94802667e7d3c35a763bc8c)\n- [stMATIC Snapshop](https://snapshot.org/#/aave.eth/proposal/0xd0e157ef44b5429df7e412126d632afa1192f84fa6045dcdcaed61bc79ad1b45)\n\nThe community has shown clear support for increasing the Supply Caps in line with the original.\n\nThe stMATIC and MaticX Supply Cap on Polygon to 40M units and 38M units respectively.\n\n# Specification\n\nThe following risk parameters changes are presented:\n\n**Polygon**\n\nTicker: stMATIC\n\nContract: [`0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4`](https://polygonscan.com/address/0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4)\n\n| Parameter | Current Value    | Proposed Value   |\n| --------- | ---------------- | ---------------- |\n| SupplyCap | 32,000,000 units | 40,000,000 units |\n\nTicker: MaticX\n\nContract: [`0xfa68FB4628DFF1028CFEc22b4162FCcd0d45efb6`](https://polygonscan.com/address/0xfa68fb4628dff1028cfec22b4162fccd0d45efb6)\n\n| Parameter | Current Value    | Proposed Value   |\n| --------- | ---------------- | ---------------- |\n| SupplyCap | 29,300,000 units | 38,000,000 units |\n\n# Implementation\n\nA list of relevant links like for this proposal:\n\n- [Test Cases](https://github.com/bgd-labs/aave-proposals/blob/main/src/AaveV3CapsUpdates_20230610/AaveV3PolCapsUpdates_20230610_PayloadTest.t.sol)\n- [Payload Implementation](https://github.com/bgd-labs/aave-proposals/blob/main/src/AaveV3CapsUpdates_20230610/AaveV3PolCapsUpdates_20230610_Payload.sol)\n\nThe proposal Payload was reviewed by [Bored Ghost Developing](https://bgdlabs.com/).\n\n# Copyright\n\nCopyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).\n"
        );

        assert_eq!(get_body("deadbeef".into()).await.unwrap(), "Unknown");
    }

    #[tokio::test]
    async fn get_json_body() {
        assert_eq!(
            get_body("8d4f6f42043d8db567d5e733762bb84a6f507997a779a66b2d17fdf9de403c13".into())
                .await
                .unwrap(),
            "{\"title\":\"Add rETH to Arbitrum Aave v3\",\"discussions\":\"https://governance.aave.com/t/arfc-add-reth-to-aave-v3-arbitrum-liquidity-pool/12810\",\"shortDescription\":\"Add rETH to Arbitrum Aave v3 deployment as collateral, with borrowing enabled.\",\"author\":\"Llama (Fermin Carranza, TokenLogic)\",\"created\":\"2023-05-24T00:00:00.000Z\",\"preview\":\"# Summary\\n\\nThis publication presents the community with the …\",\"basename\":\"AAVE-V3-ARBITRUM-RETH-LISTING\",\"description\":\"\\n\\n# Summary\\n\\nThis publication presents the community with the opportunity to add rETH to Aave Arbitrum v3. \\n\\n# Abstract\\n\\nThis proposal will add rETH to the Aave Arbtirum v3  deployment as collateral, with borrowing enabled and no isolation mode. \\n\\nrETH can be used for creating a range of yield maximising and lower carry cost leveraged trading strategies. Given the typically low borrowing cost for LSTs, users are able to borrow the LST and participate in yield strategies beyond the Aave protocol.\\n\\n# Motivation\\n\\nrETH is listed on Aave v3 Ethereum and has over $20M of deposits. Rocket Pool is expanding its support for rETH across the L2 ecosystem, first Optimism, now Arbitrum and soon Polygon. There are currently only Chainlink Oracles for Arbitrum and Ethereum. This AIP focusses on listing rETH on Arbitrum.\\n\\nLST collateral types drive material borrowing revenue to Aave as users deposit the LST and borrow the corresponding network token. This is most evident on Ethereum where the LST-wETH-yield-maximising loop is the source of the vast majority of wETH borrowing demand.\\n\\nBy providing LST diversification, Aave presents itself as a neutral platform offering users the choice between various LSTs. An added benefit of offering a variety of LSTs is the respective communities may elect to compete for user acquisition via Aave through offering incentives. This is currently happening on Aave v3 Polygon and Aave’s TVL has meaningfully increased from a relatively small base.\\n\\n# Specification\\n\\nThe parameters shown below are the [combined recommendation](https://governance.aave.com/t/arfc-add-reth-to-aave-v3-arbitrum-liquidity-pool/12810/2) of Gauntlet and Chaos Labs.\\n\\nTicker: rETH\\n\\nContract Address: [`arbitrum: 0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8`](https://arbiscan.io/address/0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8)\\n\\nChainlink Oracle rETH/ETH [`0xF3272CAfe65b190e76caAF483db13424a3e23dD2`](https://arbiscan.io/address/0x0411D28c94d85A36bC72Cb0f875dfA8371D8fFfF)\\n\\nNewly deployed Oracle rETH/ETH/USD [`0x04c28D6fE897859153eA753f986cc249Bf064f71`](https://arbiscan.io/address/0x04c28D6fE897859153eA753f986cc249Bf064f71)\\n\\n\\n|Parameter|Value|\\n| --- | --- |\\n|Isolation Mode|No|\\n|Borrowable|Yes|\\n|Collateral Enabled|Yes|\\n|Supply Cap|325 units|\\n|Borrow Cap|85 units|\\n|LTV|67.00%|\\n|LT|74.00%|\\n|Liquidation Bonus|7.50%|\\n|Liquidation Protocol Fee|10.00%|\\n|Reserve Factor|15.00%|\\n|Variable Base|0.00%|\\n|Variable Slope 1|7.00%|\\n|Variable Slope 2|300.00%|\\n|Uoptimal|45.00%|\\n|Stable Borrowing|Disabled|\\n|Stable Slope 1|13.00%|\\n|Stable Slope 2|300.00%|\\n|Base Stable Rate Offset|3.00%|\\n|Stable Rate Excess Offset|5.00%|\\n|Optimal Stable to Total Debt Ratio|20.00%|\\n|Flahloanable|Yes|\\n|Siloed Borrowing|No|\\n|Borrowed in Isolation|No|\\n\\n# Implementation\\n\\nA list of relevant links like for this proposal:\\n\\n* [Governance Forum Discussion](https://governance.aave.com/t/arfc-add-reth-to-aave-v3-arbitrum-liquidity-pool/12810)\\n* [Snapshot](https://snapshot.org/#/aave.eth/proposal/0xa7bc42ca1f658655e9998d22d616133da734bad0e6caae9c7d016ad97abf1451)\\n* [Test Cases](https://github.com/bgd-labs/aave-proposals/blob/main/src/AaveV3Listings_20230524/AaveV3ArbListings_20230524_PayloadTest.t.sol)\\n* [Payload Implementation](https://github.com/bgd-labs/aave-proposals/blob/main/src/AaveV3Listings_20230524/AaveV3ArbListings_20230524_Payload.sol)\\n\\nChaos Labs and Gauntlet both contributed to the development of the risk parameters presented above. \\n\\nThe proposal Payload was reviewed by [Bored Ghost Developing](https://bgdlabs.com/).\\n\\n# Copyright\\n\\nCopyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).\\n\"}"
        );

        assert_eq!(get_body("deadbeef".into()).await.unwrap(), "Unknown");
    }
}

#[cfg(test)]
mod aave_v2_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::{IndexerType, IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn aave_v2_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV2MainnetProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 11512328,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
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

        match AaveV2MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 11512328,
                    external_id: "0",
                    name: "AIP 5: Adding CRV to Aave",
                    body_contains: Some(vec![
                        "Aave governance proposal to enable CRV as a base asset",
                    ]),
                    url: "https://app.aave.com/governance/proposal/?proposalId=0",
                    discussion_url: None,
                    choices: json!(["For", "Against"]),
                    scores: json!([414202.51861143525, 100.20000140213439]),
                    scores_total: 414302.7186128374,
                    quorum: 0.0,
                    scores_quorum: 414202.51861143525,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2020-12-23 21:45:20"),
                    time_start: parse_datetime("2020-12-23 21:45:20"),
                    time_end: parse_datetime("2020-12-26 20:38:38"),
                    block_created: Some(11512328),
                    txid: Some(
                        "0x26b2272e31c44dd009487e66eecf1319422476967ebac7a05b39f86d1ce9fd21",
                    ),
                    metadata: json!({"vote_type": "single-choice","quorum_choices":[0]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[tokio::test]
    async fn aave_v2_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV2MainnetProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 18686736,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
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

        match AaveV2MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [
                    ExpectedProposal {
                        index_created: 18686736,
                        external_id: "389",
                        name: "Reserve Factor Updates - Polygon Aave v2",
                        body_contains: Some(vec!["This AIP is a continuation of [AIP 284](https://app.aave.com/governance/proposal/284/) and increases the Reserve Factor (RF) for assets on Polygon v2 by 5%, up to a maximum of 99.99%."]),
                        url: "https://app.aave.com/governance/proposal/?proposalId=389",
                        discussion_url: Some("https://governance.aave.com/t/arfc-reserve-factor-updates-polygon-aave-v2/13937/5".into()),
                        choices: json!(["For", "Against"]),
                        scores: json!([42312.786398795535, 0.0]),
                        scores_total: 42312.786398795535,
                        quorum: 0.0,
                        scores_quorum: 42312.786398795535,
                        proposal_state: ProposalState::Canceled,
                        marked_spam: None,
                        time_created: parse_datetime("2023-11-30 20:15:47"),
                        time_start: parse_datetime("2023-12-01 20:26:23"),
                        time_end: parse_datetime("2023-12-04 12:55:47"),
                        block_created: Some(18686736),
                        txid: Some("0xff7553c76f8df8086e4d594b3468f25f21c729e6b7cc29887ad8299d5498298f"),
                        metadata: json!({"vote_type": "single-choice","quorum_choices":[0]}).into(),
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
    async fn aave_v2_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::AaveV2MainnetProposals,
            indexer_type: IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 18790604,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
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

        match AaveV2MainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 18790604,
                    external_id: "412",
                    name: "Transfer all CRV positions from Ethereum Mainnet Collector to GLC Safe",
                    body_contains: Some(vec!["Transfer all available CRV from Aave Mainnet Treasury to GHO Liquidity Committee (GLC) SAFE where it will be deployed to sdCRV."]),
                    url: "https://app.aave.com/governance/proposal/?proposalId=412",
                    discussion_url: Some("https://governance.aave.com/t/arfc-deploy-acrv-crv-to-vecrv/11628".into()),
                    choices: json!(["For", "Against"]),
                    scores: json!([536551.6296395722, 0.0]),
                    scores_total: 536551.6296395722,
                    quorum: 0.0,
                    scores_quorum: 536551.6296395722,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2023-12-15 09:23:47"),
                    time_start: parse_datetime("2023-12-16 09:42:23"),
                    time_end: parse_datetime("2023-12-19 02:20:59"),
                    block_created: Some(18790604),
                    txid: Some("0xe80efe71357574155c123b43f08d32bc32191a3d7a8593787749c5b491f7c3ae"),
                    metadata: json!({"vote_type": "single-choice","quorum_choices":[0]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
