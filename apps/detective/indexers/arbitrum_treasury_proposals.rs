use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
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
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerType, ProposalState},
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_treasury_gov,
    "./abis/arbitrum_treasury_gov.json"
);

pub struct ArbitrumTreasuryProposalsIndexer;

#[async_trait]
impl Indexer for ArbitrumTreasuryProposalsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Proposals
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for ArbitrumTreasuryProposalsIndexer {
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Treasury Proposals");

        let arb_rpc = chain_data::get_chain_config(Chain::Arbitrum)?
            .provider
            .clone();

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("789fC99093B09aD01C34DC7251D0C89ce743e5a4");

        let gov_contract = arbitrum_treasury_gov::new(address, arb_rpc.clone());

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
            let p = data_for_proposal(p.clone(), &arb_rpc, indexer, gov_contract.clone())
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
    p: (arbitrum_treasury_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: arbitrum_treasury_gov::arbitrum_treasury_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (arbitrum_treasury_gov::ProposalCreated, Log) = p.clone();

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

    let created_block_datetime = DateTime::from_timestamp(created_block_timestamp as i64, 0)
        .context("bad timestamp")?
        .naive_utc();

    let voting_start_block_number = event.startBlock.to::<u64>();
    let mut voting_end_block_number = event.endBlock.to::<u64>();

    let gov_contract_end_block_number = gov_contract
        .proposalDeadline(event.proposalId)
        .call()
        .await?
        ._0
        .to::<u64>();

    if gov_contract_end_block_number > voting_end_block_number {
        voting_end_block_number = gov_contract_end_block_number;
    }

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

    let mut title = format!(
        "{:.120}",
        event
            .description
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
        event.proposalId
    );

    let proposal_external_id = event.proposalId.to_string();

    let onchain_proposal = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposalVotes")?;

    let choices = vec!["For", "Against", "Abstain"];

    let scores = vec![
        onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        onchain_proposal.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.forVotes.to::<u128>() as f64 / (10.0f64.powi(18))
        + onchain_proposal.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18));

    let proposal_snapshot_block = gov_contract
        .proposalSnapshot(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposalSnapshot")?
        ._0;

    let quorum = match gov_contract.quorum(proposal_snapshot_block).call().await {
        Ok(r) => r._0.to::<u128>() as f64 / (10.0f64.powi(18)),
        Err(_) => U256::from(0).to::<u128>() as f64 / (10.0f64.powi(18)),
    };

    let proposal_state = gov_contract
        .state(event.proposalId)
        .call()
        .await
        .context("gov_contract.state")?
        ._0;

    let state = match proposal_state {
        0 => ProposalState::Pending,
        1 => ProposalState::Active,
        2 => ProposalState::Canceled,
        3 => ProposalState::Defeated,
        4 => ProposalState::Succeeded,
        5 => ProposalState::Queued,
        6 => ProposalState::Expired,
        7 => ProposalState::Executed,
        _ => ProposalState::Unknown,
    };

    let body = event.description.to_string();

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: NotSet,
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(scores_quorum),
        quorum: Set(quorum),
        proposal_state: Set(state),
        marked_spam: NotSet,
        block_created: Set(Some(log.block_number.unwrap().to_i32().unwrap())),
        time_created: Set(created_block_datetime),
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

#[cfg(test)]
mod arbitrum_treasury_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn arbitrum_treasury_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbTreasuryArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 98423914,
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

        match ArbitrumTreasuryProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 98423914,
                    external_id: "79904733039853333959339953965823982558487956291458141923259498272549038367575",
                    name: "AIP-1.1 - Lockup, Budget, Transparency",
                    body_contains: Some(vec!["The Administrative Budget Wallet will be used for covering ongoing administrative and operational costs of The Arbitrum Foundation, payment of service providers, and for the purpose of fostering the growth and development of the Arbitrum ecosystem. In respect to the 7.5% that has been distributed to the Administrative Budget Wallet, a transparency report regarding the 0.5% that has already been transferred is available here 163."]),
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/79904733039853333959339953965823982558487956291458141923259498272549038367575",
                    discussion_url: "",
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([11877205.411525283, 6447687.896985268, 69223452.30270293]),
                    scores_total: 87548345.61121348,
                    scores_quorum: 81100657.71422821,
                    quorum: 86006753.44625983,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-06-06 15:56:04"),
                    time_start: parse_datetime("2023-06-09 17:03:59"),
                    time_end: parse_datetime("2023-06-23 21:04:59"),
                    block_created: Some(98423914),
                    txid: Some("0x21c3f3db7304d3278f6e0c8d2d6e2fb65ceb876c5bced84eb276c817e8d934fe"),
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
    async fn arbitrum_treasury_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbTreasuryArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 192337153 - 188757729,
            index: 188757729,
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

        match ArbitrumTreasuryProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [
                    ExpectedProposal {
                        index_created: 188757729,
                        external_id: "21881347407562908848280051025758535553780110598432331587570488445729767071232",
                        name: "[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)",
                        body_contains: Some(vec!["Back in August, Arbitrum DAO passed our AIP-3 to build a pluralistic grants framework that decentralizes grants decision-making, avoids capture and scales valuable grants allocations, and grows the Arbitrum ecosystem overall."]),
                        url: "https://www.tally.xyz/gov/arbitrum/proposal/21881347407562908848280051025758535553780110598432331587570488445729767071232",
                        discussion_url: "",
                        choices: json!(["For", "Against", "Abstain"]),
                        scores: json!([132198272.60652485, 3381866.368158056, 15924693.155036394]),
                        scores_total: 151504832.1297193,
                        scores_quorum: 148122965.76156124,
                        quorum: 76729679.14643185,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2024-03-09 20:16:53"),
                        time_start: parse_datetime("2024-03-12 20:44:59"),
                        time_end: parse_datetime("2024-03-27 00:54:23"),
                        block_created: Some(188757729),
                        txid: Some("0x44dd69debf775a83e7a4317ce9aa6344c9085c821f1a3b19a4f56cd13cc853c2"),
                        metadata: None,
                    },
                    ExpectedProposal {
                        index_created: 192337153,
                        external_id: "38070839538623347085766954167338451189998347523518753197890888828931691912919",
                        name: "Arbitrum Stable Treasury Endowment Program",
                        body_contains: Some(vec!["This proposal is a trial run for a larger investment policy of the ArbitrumDAO treasury, both in"]),
                        url: "https://www.tally.xyz/gov/arbitrum/proposal/38070839538623347085766954167338451189998347523518753197890888828931691912919",
                        discussion_url: "",
                        choices: json!(["For", "Against", "Abstain"]),
                        scores: json!([94491382.72088398, 153122.22745584013, 59798941.21114432]),
                        scores_total: 154443446.15948415,
                        scores_quorum: 154290323.9320283,
                        quorum: 81467837.817622,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2024-03-20 12:37:09"),
                        time_start: parse_datetime("2024-03-23 13:19:23"),
                        time_end: parse_datetime("2024-04-06 22:13:59"),
                        block_created: Some(192337153),
                        txid: Some("0x8086f869ce5cc30ccffc03c044e18f17f6a8acffd697dfa18aba62d32cbfae15"),
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
    async fn arbitrum_treasury_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbTreasuryArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 219487184,
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

        match ArbitrumTreasuryProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 219487184,
                    external_id: "79183200449169085571205208154003416944507585311666453826890708127615057369177",
                    name: "Kwenta x Perennial: Arbitrum Onboarding Incentives",
                    body_contains: Some(vec!["Kwenta, a prominent DeFi application in the Optimism ecosystem, is set to expand to Arbitrum, utilizing Perennial V2, an Arbitrum-native protocol. This joint proposal requests 1.9 million ARB to fund targeted onboarding incentives, aiming to bring Kwenta users to Arbitrum."]),
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/79183200449169085571205208154003416944507585311666453826890708127615057369177",
                    discussion_url: "",
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([127691476.62141035, 4316786.371440648, 28731665.366070155]),
                    scores_total: 160739928.35892117,
                    scores_quorum: 156423141.98748052,
                    quorum: 111155592.92446591,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-06-07 22:07:24"),
                    time_start: parse_datetime("2024-06-10 22:31:35"),
                    time_end: parse_datetime("2024-06-25 00:50:23"),
                    block_created: Some(219487184),
                    txid: Some("0x7ecadf902e520383a48b3a305a4dcd947652569f0650e71f5d9e4b15735c6d9b"),
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
