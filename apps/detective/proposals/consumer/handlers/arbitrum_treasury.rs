use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::arbitrum_treasury_gov::{
    arbitrum_treasury_gov::arbitrum_treasury_gov, ProposalCreatedFilter,
};
use ethers::prelude::*;
use scanners::etherscan::{self};
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

pub struct ArbitrumTreasuryHandler;

#[async_trait]
impl ProposalHandler for ArbitrumTreasuryHandler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
    ) -> Result<ProposalsResult> {
        let arb_rpc_url = std::env::var("ARBITRUM_NODE_URL").expect("Arbitrum node not set!");
        let arb_rpc = Arc::new(Provider::<Http>::try_from(arb_rpc_url).unwrap());

        let current_block = arb_rpc
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

        let address = "0x789fC99093B09aD01C34DC7251D0C89ce743e5a4"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = arbitrum_treasury_gov::new(address, arb_rpc.clone());

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
        contracts::gen::arbitrum_treasury_gov::ProposalCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: arbitrum_treasury_gov<ethers::providers::Provider<ethers::providers::Http>>,
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
    let voting_end_block_number = log.end_block.as_u64();

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

    let proposal_url = format!(
        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
        log.proposal_id
    );

    let proposal_external_id = log.proposal_id.to_string();

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
        .context("gov_contract.proposal_snapshot")?;

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

    let body = log.description.to_string();

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
mod arbitrum_treasury_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV3};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn arbitrum_treasury_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::ArbTreasuryArbitrum),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 98423914,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match ArbitrumTreasuryHandler
            .get_proposals(&dao_handler, &dao)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "79904733039853333959339953965823982558487956291458141923259498272549038367575",
                    name: "AIP-1.1 - Lockup, Budget, Transparency",
                    body_contains: vec!["tl;dr: AIP-1.1 proposes (1) a lockup, (2) a budget and (3) transparency reporting regarding the 7.5% of the $ARB tokens distributed to the Foundation’s “Administrative Budget Wallet”."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/79904733039853333959339953965823982558487956291458141923259498272549038367575",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[11877205.411525283,6447687.896985268,69223452.30270293]",
                    scores_total: 87548345.61121348,
                    scores_quorum: 81100657.71422821,
                    quorum: 86006753.44625983,
                    proposal_state: ProposalStateEnum::Defeated,
                    block_created: Some(98423914),
                    time_created: Some("2023-06-06 15:56:04"),
                    time_start: "2023-06-09 17:03:59",
                    time_end: "2023-06-23 21:04:59",
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
    async fn arbitrum_treasury_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::ArbTreasuryArbitrum),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 192337153 - 188757729,
            votes_refresh_speed: 1,
            proposals_index: 188757729,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match ArbitrumTreasuryHandler
            .get_proposals(&dao_handler, &dao)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "21881347407562908848280051025758535553780110598432331587570488445729767071232",
                    name: "[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)",
                    body_contains: vec!["Back in August, Arbitrum DAO passed our AIP-3 to build a pluralistic grants framework that decentralizes grants decision-making, avoids capture and scales valuable grants allocations, and grows the Arbitrum ecosystem overall."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/21881347407562908848280051025758535553780110598432331587570488445729767071232",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[132198272.60652485,3381866.368158056,15924693.155036394]",
                    scores_total: 151504832.1297193,
                    quorum: 76729679.14643185,
                    scores_quorum: 148122965.76156124,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(188757729),
                    time_created: Some("2024-03-09 20:16:53"),
                    time_start: "2024-03-12 20:44:59",
                    time_end: "2024-03-27 00:54:23",
                    metadata: None
                },
                ExpectedProposal {
                    external_id: "38070839538623347085766954167338451189998347523518753197890888828931691912919",
                    name: "Arbitrum Stable Treasury Endowment Program",
                    body_contains: vec!["This proposal is a trial run for a larger investment policy of the ArbitrumDAO treasury, both in"],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/38070839538623347085766954167338451189998347523518753197890888828931691912919",
                    discussion_url:
                        "",
                    choices: "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[94491382.72088398,153122.22745584013,59798941.21114432]",
                    scores_total: 154443446.15948415,
                    quorum: 81467837.817622,
                    scores_quorum: 154290323.9320283,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(192337153),
                    time_created: Some("2024-03-20 12:37:09"),
                    time_start: "2024-03-23 13:19:23",
                    time_end: "2024-04-06 18:03:47",
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
    async fn arbitrum_treasury_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::ArbTreasuryArbitrum),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 219487184,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match ArbitrumTreasuryHandler
            .get_proposals(&dao_handler, &dao)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "79183200449169085571205208154003416944507585311666453826890708127615057369177",
                    name: "Kwenta x Perennial: Arbitrum Onboarding Incentives",
                    body_contains: vec!["Kwenta, a prominent DeFi application in the Optimism ecosystem, is set to expand to Arbitrum, utilizing Perennial V2, an Arbitrum-native protocol. This joint proposal requests 1.9 million ARB to fund targeted onboarding incentives, aiming to bring Kwenta users to Arbitrum."],
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/79183200449169085571205208154003416944507585311666453826890708127615057369177",
                    discussion_url:
                        "",
                    choices:"[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[127691476.62141035,4316786.371440648,28731665.366070155]",
                    scores_total: 160739928.35892117,
                    scores_quorum: 156423141.98748052,
                    quorum: 111155592.92446591,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(219487184),
                    time_created: Some("2024-06-07 22:07:24"),
                    time_start: "2024-06-10 22:31:35",
                    time_end: "2024-06-25 00:50:23",
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
