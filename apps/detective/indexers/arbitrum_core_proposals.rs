use crate::{
    chain_data::{self},
    database::DatabaseStore,
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
use alloy::{
    primitives::{address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
    transports::http::Http,
};
use alloy_chains::NamedChain;
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::{DateTime, NaiveDateTime};
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    ConnectionTrait, Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument, warn};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arbitrum_core_gov,
    "./abis/arbitrum_core_gov.json"
);

pub struct ArbitrumCoreProposalsIndexer;

#[async_trait]
impl Indexer for ArbitrumCoreProposalsIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::ArbCoreArbitrumProposals
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for ArbitrumCoreProposalsIndexer {
    #[instrument(skip_all)]
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Core Proposals");

        let arb_rpc = chain_data::get_chain_config(NamedChain::Arbitrum)?
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

        let address = address!("f07DeD9dC292157749B6Fd268E37DF6EA38395B9");

        let gov_contract = arbitrum_core_gov::new(address, arb_rpc.clone());

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

#[instrument(skip_all)]
async fn data_for_proposal(
    p: (arbitrum_core_gov::ProposalCreated, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: arbitrum_core_gov::arbitrum_core_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log): (arbitrum_core_gov::ProposalCreated, Log) = p.clone();

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

    let voting_starts_timestamp = match chain_data::estimate_timestamp(
        NamedChain::Mainnet,
        voting_start_block_number,
    )
    .await
    {
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
        match chain_data::estimate_timestamp(NamedChain::Mainnet, voting_end_block_number).await {
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
        "https://www.tally.xyz/gov/arbitrum/proposal/{}",
        event.proposalId
    );

    let proposal_external_id = event.proposalId.to_string();

    let title = extract_title(&event.description);

    let body = event.description.to_string();

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

    let total_delegated_vp = calculate_total_delegated_vp(created_block_datetime)
        .await
        .context("Failed to calculate total delegated voting power")?;

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        author: Set(Some(event.proposer.to_string())),
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
        created_at: Set(created_block_datetime),
        start_at: Set(voting_starts_timestamp),
        end_at: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(log.block_number.unwrap().to_i32().unwrap()),
        metadata: Set(json!({"vote_type": "basic","quorum_choices":[0,2],"total_delegated_vp": total_delegated_vp}).into()),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
    })
}

#[instrument(skip_all)]
fn extract_title(description: &str) -> String {
    let mut lines = description
        .split('\n')
        .filter(|line| !line.trim().is_empty());

    // Try to find the first non-empty line that isn't just "#" markers
    let title = lines
        .find(|line| {
            let trimmed = line.trim_start_matches('#').trim();
            !trimmed.is_empty()
        })
        .unwrap_or("Unknown")
        .trim_start_matches('#')
        .trim()
        .to_string();

    // Truncate to 120 chars if needed
    if title.len() > 120 {
        title.chars().take(120).collect()
    } else {
        title
    }
}

#[instrument(skip_all)]
async fn calculate_total_delegated_vp(timestamp: NaiveDateTime) -> Result<f64> {
    use sea_orm::{DbBackend, Statement};

    let db = DatabaseStore::connect().await?;

    // Construct the raw SQL query
    let sql = r#"
        WITH latest_voting_power AS (
            SELECT
                voter,
                voting_power,
                ROW_NUMBER() OVER (
                    PARTITION BY voter
                    ORDER BY timestamp DESC, block DESC
                ) AS rn
            FROM voting_power
            WHERE
                voter != '0x00000000000000000000000000000000000A4B86'
                AND timestamp <= $1
        )
        SELECT COALESCE(SUM(voting_power), 0.0) as total_voting_power
        FROM latest_voting_power
        WHERE rn = 1
    "#;

    // Execute the raw SQL query
    let result = db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            sql,
            vec![timestamp.into()],
        ))
        .await
        .context("Failed to execute SQL query")?;

    // Extract the total voting power from the result
    let total_vp: f64 = result
        .map(|qr| qr.try_get::<f64>("", "total_voting_power"))
        .transpose()
        .context("Failed to get total_voting_power from query result")?
        .unwrap_or(0.0);

    Ok(total_vp)
}

#[cfg(test)]
mod arbitrum_core_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn test_calculate_total_delegated_vp() {
        let _ = dotenv().ok();

        let timestamp = DateTime::from_timestamp(1736985358, 0).unwrap().naive_utc(); // Example timestamp
        let result = calculate_total_delegated_vp(timestamp).await;
        assert!(result.is_ok());
        let total_vp = result.unwrap();
        assert!(total_vp == 313574334.10536474);
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn arbitrum_core_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 98424027,
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

        match ArbitrumCoreProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 98424027,
                    external_id: "77049969659962393408182308518930939247285848107346513112985531885924337078488",
                    name: "AIP-1.2 - Foundation and DAO Governance",
                    body_contains: Some(vec!["proposes amendments to the Constitution, and The Arbitrum Foundation Amended & Restated Memorandum & Articles of Association "]),
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/77049969659962393408182308518930939247285848107346513112985531885924337078488",
                    discussion_url: None,
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([184321656.8392574, 102537.9383272933, 82161.17151725784]),
                    scores_total: 184506355.94910192,
                    scores_quorum: 184403818.01077464,
                    quorum: 143344589.07709968,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2023-06-06 15:56:32"),
                    time_start: parse_datetime("2023-06-09 17:04:35"),
                    time_end: parse_datetime("2023-06-23 21:05:35"),
                    block_created: Some(98424027),
                    txid: Some("0xea591d2cba10b1e386791334ba528bd3dde79bdc38c4b3ba69c4eb639b08eb0e"),
                    metadata: json!({"vote_type": "basic","quorum_choices":[0,2],"total_delegated_vp": 281076755.62228465}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn arbitrum_core_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 166717878 - 162413941,
            index: 162413941,
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

        match ArbitrumCoreProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [
                    ExpectedProposal {
                        index_created: 162413941,
                        external_id: "77069694702187027448745871790562515795432836429094222862498991082283032976814",
                        name: "AIP: ArbOS Version 11",
                        body_contains: Some(vec!["This AIP introduces a number of improvements to Arbitrum chains, including support for the EVM Shanghai upgrade and the PUSH0 opcode, along with miscellaneous bug fixes."]),
                        url: "https://www.tally.xyz/gov/arbitrum/proposal/77069694702187027448745871790562515795432836429094222862498991082283032976814",
                        discussion_url: None,
                        choices: json!(["For", "Against", "Abstain"]),
                        scores: json!([169579454.9409183, 317521.32779523754, 38813.26850477806]),
                        scores_total: 169935789.5372183,
                        scores_quorum: 169618268.20942307,
                        quorum: 124807585.7770997,
                        proposal_state: ProposalState::Executed,
                        marked_spam: None,
                        time_created: parse_datetime("2023-12-22 00:25:34"),
                        time_start: parse_datetime("2023-12-25 01:11:35"),
                        time_end: parse_datetime("2024-01-08 05:23:47"),
                        block_created: Some(162413941),
                        txid: Some("0x9314b7fe649633dace3294c0d90a208010c954f593a42dedc10939c681437420"),
                        metadata: json!({"vote_type": "basic","quorum_choices":[0,2],"total_delegated_vp": 358178632.3811636}).into(),
                    },
                    ExpectedProposal {
                        index_created: 166717878,
                        external_id: "13830398746784164287014809687499019395362322167304875665797507515532859950760",
                        name: "Proposal to Establish the Arbitrum Research & Development Collective",
                        body_contains: Some(vec!["This proposal aims to fund the Arbitrum Research & Development Collective to aid in turning Arbitrum DAO members’ ideas into reality for a term of 6 months."]),
                        url: "https://www.tally.xyz/gov/arbitrum/proposal/13830398746784164287014809687499019395362322167304875665797507515532859950760",
                        discussion_url: None,
                        choices: json!(["For", "Against", "Abstain"]),
                        scores: json!([2185041.519587313, 25445239.242508475, 26755.596383426277]),
                        scores_total: 27657036.358479213,
                        scores_quorum: 2211797.115970739,
                        quorum: 124807585.7770997,
                        proposal_state: ProposalState::Defeated,
                        marked_spam: None,
                        time_created: parse_datetime("2024-01-03 16:30:40"),
                        time_start: parse_datetime("2024-01-06 17:29:11"),
                        time_end: parse_datetime("2024-01-20 20:21:35"),
                        block_created: Some(166717878),
                        txid: Some("0x2e267411550d7b284f81ee77f4b210adbe21f73b34a04ff3c7cebe61225abd64"),
                        metadata: json!({"vote_type": "basic","quorum_choices":[0,2],"total_delegated_vp": 352877174.3468493}).into(),
                    }
                ];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn arbitrum_core_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 214219081,
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

        match ArbitrumCoreProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 214219081,
                    external_id: "108365944612843449282647711225577270624871742641825297712833904029381791489297",
                    name: "Constitutional AIP - Security Council Improvement Proposal",
                    body_contains: Some(vec!["This AIP seeks to propose changes to the structure of the security council so Arbitrum can maintain the"]),
                    url: "https://www.tally.xyz/gov/arbitrum/proposal/108365944612843449282647711225577270624871742641825297712833904029381791489297",
                    discussion_url: None,
                    choices: json!(["For", "Against", "Abstain"]),
                    scores: json!([188603668.01589176, 77045.62086160998, 87680.32079629744]),
                    scores_total: 188768393.9575497,
                    scores_quorum: 188691348.33668807,
                    quorum: 175916805.40235552,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-05-23 13:19:47"),
                    time_start: parse_datetime("2024-05-26 13:47:11"),
                    time_end: parse_datetime("2024-06-09 15:44:11"),
                    block_created: Some(214219081),
                    txid: Some("0x14e95b41165dca8abbcfe9b1ffdbc2e1df849b29ccfc279cf6b42b52d7f026d1"),
                    metadata: json!({"vote_type": "basic","quorum_choices":[0,2],"total_delegated_vp": 322880613.43067163}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
