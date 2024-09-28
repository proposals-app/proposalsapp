use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::arbitrum_core_gov::{
    arbitrum_core_gov::arbitrum_core_gov, ProposalCreatedFilter,
};
use ethers::prelude::*;
use scanners::etherscan::{self};
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, instrument, warn};

pub struct ArbitrumCoreHandler;

#[async_trait]
impl ProposalHandler for ArbitrumCoreHandler {
    #[instrument(skip(self, dao_handler, _dao,), fields(dao_handler_id = %dao_handler.id, from_index))]
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
        from_index: i32,
    ) -> Result<ProposalsResult> {
        info!("Fetching proposals for ArbitrumCoreHandler");
        let arb_rpc_url = std::env::var("ARBITRUM_NODE_URL").expect("Arbitrum node not set!");
        let arb_rpc = Arc::new(Provider::<Http>::try_from(arb_rpc_url).unwrap());

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")?
            .as_u64();

        let from_block = from_index;
        let to_block =
            if from_index as u64 + dao_handler.proposals_refresh_speed as u64 > current_block {
                current_block
            } else {
                from_index as u64 + dao_handler.proposals_refresh_speed as u64
            };

        let address = "0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = arbitrum_core_gov::new(address, arb_rpc.clone());

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
            let p = data_for_proposal(p.clone(), &arb_rpc, dao_handler, gov_contract.clone())
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
        10_000_000
    }
}

async fn data_for_proposal(
    p: (
        contracts::gen::arbitrum_core_gov::ProposalCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: arbitrum_core_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?
        .context("bad block")?;

    let created_block_timestamp = created_block.timestamp.as_u64() as i64;
    let created_block_naive_datetime = NaiveDateTime::from_timestamp(created_block_timestamp, 0);

    let created_block_ethereum = etherscan::estimate_block(created_block_timestamp as u64).await?;

    let voting_start_block_number = log.start_block.as_u64();
    let mut voting_end_block_number = log.end_block.as_u64();

    let gov_contract_end_block_number = gov_contract
        .proposal_deadline(log.proposal_id)
        .await?
        .as_u64();

    if gov_contract_end_block_number > voting_end_block_number {
        voting_end_block_number = gov_contract_end_block_number;
    }

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp =
        match etherscan::estimate_timestamp(voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => {
                #[allow(deprecated)]
                let fallback = NaiveDateTime::from_timestamp_millis(
                    (created_block_timestamp * 1000)
                        + (voting_start_block_number as i64 - created_block_ethereum as i64)
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

    let voting_ends_timestamp = match etherscan::estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        Err(_) => {
            #[allow(deprecated)]
            let fallback = NaiveDateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_end_block_number as i64 - created_block_ethereum as i64)
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
        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
        log.proposal_id
    );

    let proposal_external_id = log.proposal_id.to_string();

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

    let onchain_proposal = gov_contract
        .proposal_votes(log.proposal_id)
        .call()
        .await
        .context("gov_contract.proposal_votes")?;

    let choices = vec!["For", "Against", "Abstain"];

    let scores = vec![
        onchain_proposal.1.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.0.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.2.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.1.as_u128() as f64 / (10.0f64.powi(18))
        + onchain_proposal.2.as_u128() as f64 / (10.0f64.powi(18));

    let proposal_snapshot_block = gov_contract
        .proposal_snapshot(log.proposal_id)
        .await
        .context(
            "gov_contract
        .proposal_snapshot",
        )?;

    let quorum = match gov_contract.quorum(proposal_snapshot_block).await {
        Ok(r) => r.as_u128() as f64 / (10.0f64.powi(18)),
        Err(_) => U256::from(0).as_u128() as f64 / (10.0f64.powi(18)),
    };

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .call()
        .await
        .context("gov_contract.state")?;

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
        time_created: Set(Some(created_block_naive_datetime)),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(created_block_number as i32),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
        metadata: NotSet,
    })
}

#[cfg(test)]
mod arbitrum_core_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV4};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn arbitrum_core_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV4::ArbCoreArbitrum),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 98424027,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match ArbitrumCoreHandler
            .get_proposals(&dao_handler, &dao, dao_handler.proposals_index)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "77049969659962393408182308518930939247285848107346513112985531885924337078488",
                    name: "AIP-1.2 - Foundation and DAO Governance",
                    body_contains: vec!["This document (“AIP-1.2”) proposes amendments to the Constitution, and The Arbitrum Foundation Amended & Restated Memorandum & Articles of Association (the “A&R M&A”) and Bylaws (the “Bylaws”) to (1) remove references to AIP-1, and (2) make other changes reflecting feedback from the community."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/77049969659962393408182308518930939247285848107346513112985531885924337078488",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[184321656.8392574,102537.9383272933,82161.17151725784]",
                    scores_total: 184506355.94910192,
                    scores_quorum: 184403818.01077464,
                    quorum: 143344589.07709968,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(98424027),
                    time_created: Some("2023-06-06 15:56:32"),
                    time_start: "2023-06-09 17:04:35",
                    time_end: "2023-06-23 21:05:35",
                    metadata: None
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn arbitrum_core_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV4::ArbCoreArbitrum),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 166717878 - 162413941,
            votes_refresh_speed: 1,
            proposals_index: 162413941,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match ArbitrumCoreHandler
            .get_proposals(&dao_handler, &dao, dao_handler.proposals_index)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "77069694702187027448745871790562515795432836429094222862498991082283032976814",
                    name: "AIP: ArbOS Version 11",
                    body_contains: vec!["This AIP introduces a number of improvements to Arbitrum chains, including support for the EVM Shanghai upgrade and the PUSH0 opcode, along with miscellaneous bug fixes. These improvements are now audited and ready for adoption, including by Arbitrum Orbit chains, Arbitrum One, and Arbitrum Nova. This proposal concerns the latter two, as they are governed by the Arbitrum DAO."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/77069694702187027448745871790562515795432836429094222862498991082283032976814",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[169579454.9409183,317521.32779523754,38813.26850477806]",
                    scores_total: 169935789.5372183,
                    scores_quorum: 169618268.20942307,
                    quorum: 124807585.7770997,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(162413941),
                    time_created: Some("2023-12-22 00:25:34"),
                    time_start: "2023-12-25 01:11:35",
                    time_end: "2024-01-08 05:23:47",
                    metadata: None
                },
                ExpectedProposal {
                    external_id: "13830398746784164287014809687499019395362322167304875665797507515532859950760",
                    name: "Proposal to Establish the Arbitrum Research & Development Collective",
                    body_contains: vec!["This proposal aims to fund the Arbitrum Research & Development Collective to aid in turning Arbitrum DAO members’ ideas into reality for a term of 6 months."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/13830398746784164287014809687499019395362322167304875665797507515532859950760",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[2185041.519587313,25445239.242508475,26755.596383426277]",
                    scores_total: 27657036.358479213,
                    scores_quorum: 2211797.115970739,
                    quorum: 124807585.7770997,
                    proposal_state: ProposalStateEnum::Defeated,
                    block_created: Some(166717878),
                    time_created: Some("2024-01-03 16:30:40"),
                    time_start: "2024-01-06 17:29:11",
                    time_end: "2024-01-20 20:21:35",
                    metadata: None
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn arbitrum_core_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV4::ArbCoreArbitrum),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 214219081,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match ArbitrumCoreHandler
            .get_proposals(&dao_handler, &dao, dao_handler.proposals_index)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "108365944612843449282647711225577270624871742641825297712833904029381791489297",
                    name: "Constitutional AIP - Security Council Improvement Proposal ",
                    body_contains: vec!["This AIP seeks to propose changes to the structure of the security council so Arbitrum can maintain the “Stage 1” designation as per L2BEAT and not fall back to “Stage 0” designation."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/108365944612843449282647711225577270624871742641825297712833904029381791489297",
                    discussion_url:
                        "",
                    choices:"[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[188603668.01589176,77045.62086160998,87680.32079629744]",
                    scores_total: 188768393.9575497,
                    scores_quorum: 188691348.33668807,
                    quorum: 175916805.40235552,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(214219081),
                    time_created: Some("2024-05-23 13:19:47"),
                    time_start: "2024-05-26 13:47:11",
                    time_end: "2024-06-09 15:44:11",
                    metadata: None
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
