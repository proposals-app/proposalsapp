use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::compound_gov::{compound_gov::compound_gov, ProposalCreatedFilter};
use ethers::prelude::*;
use scanners::etherscan::estimate_timestamp;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

pub struct CompoundHandler;

#[async_trait]
impl ProposalHandler for CompoundHandler {
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

        let address = "0xc0Da02939E1441F497fd74F78cE7Decb17B66529"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = compound_gov::new(address, eth_rpc.clone());

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
    p: (contracts::gen::compound_gov::ProposalCreatedFilter, LogMeta),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: compound_gov<ethers::providers::Provider<ethers::providers::Http>>,
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

    let proposal_url = format!("https://compound.finance/governance/proposals/{}", log.id);

    let proposal_external_id = log.id.to_string();

    let onchain_proposal = gov_contract
        .proposals(log.id)
        .call()
        .await
        .context("gov_contract.proposals")?;

    let mut title = format!(
        "{:.120}",
        log.description
            .split('\n')
            .next()
            .unwrap_or("Unknown")
            .to_string()
    );

    if title.starts_with("# ") {
        title = title.split_off(2);
    }

    if title.is_empty() {
        title = "Unknown".into()
    }

    let body = log.description.to_string();

    if title.starts_with("# ") {
        title = title.split_off(2);
    }

    if title.is_empty() {
        title = "Unknown".into()
    }

    let choices = vec!["For", "Against", "Abstain"];

    let scores = vec![
        onchain_proposal.5.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.6.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.7.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = onchain_proposal.5.as_u128() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorum_votes()
        .call()
        .await
        .context("gov_contract.quorum_votes")?
        .as_u128() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(log.id)
        .call()
        .await
        .context("gov_contract.state")
        .unwrap_or(99); //default to Unknown

    let state = match proposal_state {
        0 => ProposalStateEnum::Pending,
        1 => ProposalStateEnum::Active,
        2 => ProposalStateEnum::Canceled,
        3 => ProposalStateEnum::Defeated,
        4 => ProposalStateEnum::Succeeded,
        5 => ProposalStateEnum::Queued,
        6 => ProposalStateEnum::Expired,
        7 => ProposalStateEnum::Executed,
        _ => ProposalStateEnum::Unknown,
    };

    let discussionurl = String::from("");

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

#[cfg(test)]
mod compound_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV2};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn compound_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV2::CompoundMainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 12235671,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match CompoundHandler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "43",
                    name: "Governance Analysis Period",
                    body_contains: vec!["This would allow the community and developers additional time to audit new contracts and proposals for errors, and users the opportunity to move COMP or delegations prior to a vote commencing."],
                    url: "https://compound.finance/governance/proposals/43",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[1367841.9649007607,5000.0,0.0]",
                    scores_total: 1372841.9649007607,
                    scores_quorum: 1367841.9649007607,
                    quorum: 399999.99999999994,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(12235671),
                    time_created: Some("2021-04-14 03:00:21"),
                    time_start: "2021-04-14 03:00:23",
                    time_end: "2021-04-16 19:13:09",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn compound_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV2::AaveV3Mainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 20215251 - 20214270,
            votes_refresh_speed: 1,
            proposals_index: 20214270,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match CompoundHandler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "271",
                    name: "[Gauntlet] - WETH Arbitrum v3 Global Param Updates",
                    body_contains: vec!["Gauntlet recommends to adjust these params to match the setting on Base WETH Comet. The adjustment to lower BASE Borrow Min will allow users to borrow lower amounts of WETH and Base Min Rewards the adjustment will allow the incentives to kick off earlier within the market."],
                    url: "https://compound.finance/governance/proposals/271",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[381721.9323550018,0.0,50007.948335668865]",
                    scores_total: 431729.8806906707,
                    scores_quorum: 381721.9323550018,
                    quorum: 399999.99999999994,
                    proposal_state: ProposalStateEnum::Defeated,
                    block_created: Some(20214270),
                    time_created: Some("2024-07-01 21:10:47"),
                    time_start: "2024-07-03 17:15:35",
                    time_end: "2024-07-06 11:18:59",
                },
                ExpectedProposal {
                    external_id: "272",
                    name: "[Gauntlet] Polygon USDC.e and Scroll USDC - Risk and Incentive Recommendations",
                    body_contains: vec!["Gauntlet recommends adjusting Polygon USDC.e Comet's supply caps to risk off under utilized caps and reducing incentives to account for the higher costs per USDC.e within the protocol."],
                    url:  "https://compound.finance/governance/proposals/272",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[475671.1200245885,0.0,0.0]",
                    scores_total: 475671.1200245885,
                    scores_quorum: 475671.1200245885,
                    quorum: 399999.99999999994,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(20215251),
                    time_created: Some("2024-07-02 00:27:59"),
                    time_start: "2024-07-03 20:31:59",
                    time_end: "2024-07-06 14:35:47",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn compound_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV2::CompoundMainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 20355844,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match CompoundHandler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "284",
                    name: "Add wstETH as collateral into cUSDCv3 on Optimism",
                    body_contains: vec!["Compound Growth Program [AlphaGrowth] proposes to add wstETH into cUSDCv3 on Optimism network."],
                    url: "https://compound.finance/governance/proposals/284",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[560578.7289136582,0.0,0.0]",
                    scores_total: 560578.7289136582,
                    scores_quorum: 560578.7289136582,
                    quorum: 399999.99999999994,
                    proposal_state: ProposalStateEnum::Queued,
                    block_created: Some(20355844),
                    time_created: Some("2024-07-21 15:35:59"),
                    time_start: "2024-07-23 11:38:35",
                    time_end: "2024-07-26 05:40:47",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
