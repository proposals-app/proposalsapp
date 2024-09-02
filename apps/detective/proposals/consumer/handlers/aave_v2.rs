use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::{
    aave_v_2_executor::aave_v2_executor,
    aave_v_2_gov::{aave_v2_gov, ProposalCreatedFilter},
    aave_v_2_strategy::aave_v2_strategy,
};
use ethers::{prelude::*, utils::hex};
use regex::Regex;
use scanners::etherscan::estimate_timestamp;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, warn};

pub struct AaveV2Handler;

#[async_trait]
impl ProposalHandler for AaveV2Handler {
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

        let address = "0xEC568fffba86c094cf06b22134B23074DFE2252c"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = aave_v2_gov::new(address, eth_rpc.clone());

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
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (contracts::gen::aave_v_2_gov::ProposalCreatedFilter, LogMeta),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: aave_v2_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.getblock")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let voting_start_block_number = log.start_block.as_u64();
    let voting_end_block_number = log.end_block.as_u64();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        Err(_) => {
            #[allow(deprecated)]
            let fallback = NaiveDateTime::from_timestamp_millis(
                (created_block_timestamp.and_utc().timestamp() * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64)
                        * average_block_time_millis,
            )
            .context("bad timestamp")?;
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
            #[allow(deprecated)]
            let fallback = NaiveDateTime::from_timestamp_millis(
                created_block_timestamp.and_utc().timestamp() * 1000
                    + (voting_end_block_number - created_block_number) as i64
                        * average_block_time_millis,
            )
            .context("bad timestamp")?;
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
        log.id
    );

    let proposal_external_id = log.id.to_string();

    let executor_contract = aave_v2_executor::new(log.executor, rpc.clone());

    let strategy_contract = aave_v2_strategy::new(log.strategy, rpc.clone());

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

    let scores_quorum = onchain_proposal.for_votes.as_u128() as f64 / (10.0f64.powi(18));

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
        .unwrap_or(if onchain_proposal.executed {
            7
        } else if onchain_proposal.canceled {
            1
        } else {
            99
        }); //default to Unknown

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
        scores_quorum: Set(scores_quorum),
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

        if retries < 5 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 5 retries
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

        if retries < 5 {
            retries += 1;
            let backoff_duration = Duration::from_millis(2u64.pow(retries as u32));
            tokio::time::sleep(backoff_duration).await;
        } else {
            return Ok("Unknown".to_string()); // Exit after 5 retries
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
    use crate::handlers::aave_v2::{get_body, get_discussion, get_title};

    #[tokio::test]
    async fn get_markdown_title() {
        assert_eq!(
            get_title("f76d79693a81a1c0acd23c6ee151369752142b0d832daeaef9a4dd9f8c4bc7ce".into())
                .await
                .unwrap(),
            "Polygon Supply Cap Update"
        );

        assert_eq!(
            get_title("12f2d9c91e4e23ae4009ab9ef5862ee0ae79498937b66252213221f04a5d5b32".into())
                .await
                .unwrap(),
            "Add 1INCH to Aave v2 market"
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
            .await
            .unwrap(),
            "https://governance.aave.com/t/arfc-polygon-v3-supply-cap-update-2023-05-21/13161"
        );

        assert_eq!(
            get_discussion(
                "12f2d9c91e4e23ae4009ab9ef5862ee0ae79498937b66252213221f04a5d5b32".into()
            )
            .await
            .unwrap(),
            "https://governance.aave.com/t/arc-add-1inch-as-collateral/8056"
        );

        assert_eq!(
            get_discussion(
                "e7e93497d3847536f07fe8dba53485cf68a275c7b07ca38b53d2cc2d43fab3b0".into()
            )
            .await
            .unwrap(),
            "Unknown"
        );

        assert_eq!(get_discussion("deadbeef".into()).await.unwrap(), "Unknown");
    }

    #[tokio::test]
    async fn get_json_discussionurl() {
        assert_eq!(
            get_discussion(
                "8d4f6f42043d8db567d5e733762bb84a6f507997a779a66b2d17fdf9de403c13".into()
            )
            .await
            .unwrap(),
            "https://governance.aave.com/t/arfc-add-reth-to-aave-v3-arbitrum-liquidity-pool/12810"
        );

        assert_eq!(get_discussion("deadbeef".into()).await.unwrap(), "Unknown");
    }

    #[tokio::test]
    async fn get_markdown_body() {
        assert_eq!(
            get_body("f76d79693a81a1c0acd23c6ee151369752142b0d832daeaef9a4dd9f8c4bc7ce".into())
                .await
                .unwrap(),
            "---\ntitle: Polygon Supply Cap Update\ndiscussions: https://governance.aave.com/t/arfc-polygon-v3-supply-cap-update-2023-05-21/13161\nshortDescription: Increase SupplyCap stMATIC and MaticX on Polygon v3 from 30M units to 40M units and 29.3M to 38M units respectively.\nauthor: Llama (Fermin Carranza and TokenLogic)\ncreated: 2023-06-08\n---\n\n# Summary\n\nThis AIP increases the stMATIC and MaticX Supply Cap on Polygon to 40M units and 38M units respectively.\n\n# Abstract\n\nThe utilisation of the stMATIC and MaticX Supply Caps has reached 100% and is preventing strategies built on Aave Protocol from depositing into these reserves.\n\nThe yield maximising strategy is current incentivised by two communities, Polygon Foundation and Stader Labs. These incentives encourage users to deposit either Liquid Staking Token (LST) into Aave v3 Protocl.\n\nThis AIP, with support from Chaos Labs and a favourable Snapshot, shall increase the Supply Caps to enable users to deposit funds in the stMATIC and MaticX reserves on Polygon v3.\n\n# Motivation\n\nOver the previous months, Llama has been working with various communities to craft favourable conditions on Aave v3 Polygon to facilitate the creation of several yield aggregation products. These products are now active with more soon to be deployed.\n\nWith conservative Supply Caps being implemented and filled within minutes, or hours, communities who have built products on Aave v3 are experiencing great frustration. After investing time, resources and incurring audit costs, these communities are unable to promote their products to prospective users without the newly implemented Supply Caps being filled.\n\nFor these integrations to be successful, the Supply Caps need to be increased such that a wide array of prospective users can enter into these automated strategies. Currently, the smaller Supply Cap increases are filling quickly and we are experiencing several whales / products absoring near 100% of newly implemented Supply Caps is not promoting a desirable UX for users.\n\nThe original ARFC links below:\n\n- [MaticX Forum Post](https://governance.aave.com/t/arfc-polygon-supply-cap-update-23-05-2023/13190)\n- [stMATIC Forum Post](https://governance.aave.com/t/arfc-polygon-v3-supply-cap-update-2023-05-21/13161)\n\nThe proposed Supply Caps are supported by Chaos Labs. However, Gauntlet has a more conservative risk model which limits the Supply Cap to 50% of supply on the network relative to Chaose Lab's 75%. This difference leads to differing Supply Cap recommendations. Do note, Aave DAO voted to increase the Supply Caps to [75%](https://snapshot.org/#/aave.eth/proposal/0xf9261916c696ce2d793af41b7fe556896ed1ff7a8330b7d0489d5567ebefe3ba) of supply. A Snapshot vote for each Supply Cap is linked below:\n\n- [MaticX Snapshot](https://snapshot.org/#/aave.eth/proposal/0xbbb92805d7b15d46d668cdc8e40d9a15e6a3ed2ac94802667e7d3c35a763bc8c)\n- [stMATIC Snapshop](https://snapshot.org/#/aave.eth/proposal/0xd0e157ef44b5429df7e412126d632afa1192f84fa6045dcdcaed61bc79ad1b45)\n\nThe community has shown clear support for increasing the Supply Caps in line with the original.\n\nThe stMATIC and MaticX Supply Cap on Polygon to 40M units and 38M units respectively.\n\n# Specification\n\nThe following risk parameters changes are presented:\n\n**Polygon**\n\nTicker: stMATIC\n\nContract: [`0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4`](https://polygonscan.com/address/0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4)\n\n| Parameter | Current Value    | Proposed Value   |\n| --------- | ---------------- | ---------------- |\n| SupplyCap | 32,000,000 units | 40,000,000 units |\n\nTicker: MaticX\n\nContract: [`0xfa68FB4628DFF1028CFEc22b4162FCcd0d45efb6`](https://polygonscan.com/address/0xfa68fb4628dff1028cfec22b4162fccd0d45efb6)\n\n| Parameter | Current Value    | Proposed Value   |\n| --------- | ---------------- | ---------------- |\n| SupplyCap | 29,300,000 units | 38,000,000 units |\n\n# Implementation\n\nA list of relevant links like for this proposal:\n\n- [Test Cases](https://github.com/bgd-labs/aave-proposals/blob/main/src/AaveV3CapsUpdates_20230610/AaveV3PolCapsUpdates_20230610_PayloadTest.t.sol)\n- [Payload Implementation](https://github.com/bgd-labs/aave-proposals/blob/main/src/AaveV3CapsUpdates_20230610/AaveV3PolCapsUpdates_20230610_Payload.sol)\n\nThe proposal Payload was reviewed by [Bored Ghost Developing](https://bgdlabs.com/).\n\n# Copyright\n\nCopyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).\n"
        );

        assert_eq!(
            get_body("12f2d9c91e4e23ae4009ab9ef5862ee0ae79498937b66252213221f04a5d5b32".into())
                .await
                .unwrap(),
            "---\ntitle: Add 1INCH to Aave v2 market\nstatus: Proposed\nauthor: Governance House - [Llama](https://twitter.com/llama), [Matthew Graham](https://twitter.com/Matthew_Graham_), [defijesus.eth](https://twitter.com/eldefijesus)\nshortDescription: Add 1INCH as collateral on the Aave V2 market\ndiscussions: https://governance.aave.com/t/arc-add-1inch-as-collateral/8056\ncreated: 2022-07-18\n---\n\n\n## Simple Summary\n\nLlama proposes listing 1INCH, the governance token of the 1inch Network, on Aave v2 mainnet as collateral with borrowing enabled. The risk parameters detailed within have been provided by Gauntlet. \n\n## Abstract\n\n1inch is a network of decentralized protocols designed to provide the fastest and most efficient operations in the DeFi space. The 1inch Network was launched in May 2019 with the release of its Aggregation Protocol v1. The 1inch Aggregation Protocol is both the oldest and most trusted DEX aggregator in the DeFi space.\n\nListing 1INCH on Aave v2 will enable lenders to receive yield and borrowers of 1INCH to partake in 1inch’s tokenomics to vote and be reimbursed their gas cost to perform swaps on 1inch’s Aggregation Platform.\n\n## Motivation\n\nListing 1INCH on the Aave v2 market would allow Aave to benefit from the first mover advantage and recognise the efforts of the 1inch team for being supportive of Aave since before v1.  \n\nSince the original proposal to list 1INCH the team has removed minting roles on the token, introduced a progressive vesting schedule and created use cases for aTokens. The 1INCH token is supported by a Chainlink oracle feed and has favourable on-chain liquidity conditions.\n\n## Specification\n\nThis proposal initializes the 1INCH reserve, enables variable borrowing, sets a reserve factor and configures the reserve as collateral. As needed, it also connects a price source on the AaveOracle.\n\n## Test Cases\n\nAll the components involved in this proposal (tokens' implementations, interest rate strategy, oracle feed, proposal payload) have been tested and reviewed, including simulations on mainnet of the whole proposal lifecycle.\n\nLink to Test Cases: [End-to-end test suite](https://github.com/defijesus/bdg-labs-aave-v2-listings/blob/master/src/test/Validation1InchListing.sol), [aToken/stableDebtToken/variableDebtToken verification](https://github.com/defijesus/bdg-labs-aave-v2-listings/tree/master/diffs), [deployment script](https://github.com/defijesus/bdg-labs-aave-v2-listings/blob/master/scripts/1InchListingPayload.s.sol)\n\n## Implementation\n\nWe recommend the following risk parameters.\n\n### Risk Parameters:\n\nLTV 40%\n\nLiquidation Threshold 50%\n\nLiquidation Bonus 8.5%\n\nReserve Factor 20%\n\n### Variable Interest Rate Parameters:\n\nUOptimal 45%\n\nR_0 0%\n\nR_s1 7%\n\nR_s2 300%\n\n\nThe snapshot vote to add 1INCH on Aave v2 mainnet market can be found [here](https://snapshot.org/#/aave.eth/proposal/0x2ea76814a0dfcad7ea1a7b3c597f059a8d574f8143886b23043918998505f5a7).  \n\n\n- [ProposalPayload](https://etherscan.io/address/0xd417d07c20e31f6e129fa68182054b641fbec8bd#code)\n- [aINCH implementation](https://etherscan.io/address/0x130FBED7dBA2b370f0F93b0Caea2cfD9b811D66D#code)\n- [Variable Debt 1INCH implementation](https://etherscan.io/address/0x4d3707566Ee8a0ed6DE424a262050C7587da8152#code)\n- [Stable Debt 1INCH implementation](https://etherscan.io/address/0x9C2114Bf70774C36E9b8d6c790c9C14FF0d6799E#code)\n- [Interest rate strategy](https://etherscan.io/address/0xb2eD1eCE1c13455Ce9299d35D3B00358529f3Dc8#code) \n- [1INCH/ETH price feed](https://etherscan.io/address/0x72AFAECF99C9d9C8215fF44C77B94B99C28741e8#code)\n\n## Copyright\n\nCopyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/)."
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
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV3};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn aave_v2_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::AaveV2Mainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 11512328,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match AaveV2Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "0",
                    name: "AIP 5: Adding CRV to Aave",
                    body_contains: vec!["Curve is an exchange liquidity pool on Ethereum designed for extremely efficient stablecoin trading. It is the second biggest DEX on Ethereum and the third biggest protocol by TVL."],
                    url: "https://app.aave.com/governance/proposal/?proposalId=0",
                    discussion_url:
                        "Unknown",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[414202.51861143525,100.20000140213439]",
                    scores_total: 414302.7186128374,
                    scores_quorum: 414202.51861143525,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(11512328),
                    time_created: Some("2020-12-23 21:45:20"),
                    time_start: "2020-12-23 21:45:20",
                    time_end: "2020-12-26 20:38:38",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn aave_v2_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::AaveV2Mainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 18686736 - 18678972,
            votes_refresh_speed: 1,
            proposals_index: 18678972,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match AaveV2Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "388",
                    name: "GHO_Incident_Report",
                    body_contains: vec!["Provide a bounty to a community member for helping to detect an incident with GHO."],
                    url: "https://app.aave.com/governance/proposal/?proposalId=388",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-gho-bounty-for-integration-issue-detection/15296",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[502888.9536269785,0.0]",
                    scores_total: 502888.9536269785,
                    scores_quorum: 502888.9536269785,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(18678972),
                    time_created: Some("2023-11-29 18:11:35"),
                    time_start: "2023-11-30 18:21:47",
                    time_end: "2023-12-03 10:49:11",
                },
                ExpectedProposal {
                    external_id: "389",
                    name: "Reserve Factor Updates - Polygon Aave v2",
                    body_contains: vec!["This AIP is a continuation of [AIP 284](https://app.aave.com/governance/proposal/284/) and increases the Reserve Factor (RF) for assets on Polygon v2 by 5%, up to a maximum of 99.99%."],
                    url: "https://app.aave.com/governance/proposal/?proposalId=389",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-reserve-factor-updates-polygon-aave-v2/13937/5",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[42312.786398795535,0.0]",
                    scores_total: 42312.786398795535,
                    scores_quorum: 42312.786398795535,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Canceled,
                    block_created: Some(18686736),
                    time_created: Some("2023-11-30 20:15:47"),
                    time_start: "2023-12-01 20:26:23",
                    time_end: "2023-12-04 12:55:47",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn aave_v2_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::AaveV2Mainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 18790604,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match AaveV2Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "412",
                    name: "Transfer all CRV positions from Ethereum Mainnet Collector to GLC Safe",
                    body_contains: vec!["Transfer all available CRV from Aave Mainnet Treasury to GHO Liquidity Committee (GLC) SAFE where it will be deployed to sdCRV."],
                    url: "https://app.aave.com/governance/proposal/?proposalId=412",
                    discussion_url:
                        "https://governance.aave.com/t/arfc-deploy-acrv-crv-to-vecrv/11628",
                    choices: "[\"For\",\"Against\"]",
                    scores: "[536551.6296395722,0.0]",
                    scores_total: 536551.6296395722,
                    scores_quorum: 536551.6296395722,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(18790604),
                    time_created: Some("2023-12-15 09:23:47"),
                    time_start: "2023-12-16 09:42:23",
                    time_end: "2023-12-19 02:20:59",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
