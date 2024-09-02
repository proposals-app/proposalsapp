use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::optimism_gov_v_6::{optimism_gov_v_6::optimism_gov_v6, ProposalCreated1Filter};
use ethers::prelude::*;
use scanners::optimistic_scan::estimate_timestamp;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::sync::Arc;

pub struct OptimismType1Handler;

#[async_trait]
impl ProposalHandler for OptimismType1Handler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
    ) -> Result<ProposalsResult> {
        let op_rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
        let op_rpc = Arc::new(Provider::<Http>::try_from(op_rpc_url).unwrap());

        let current_block = op_rpc
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

        let address = "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = optimism_gov_v6::new(address, op_rpc.clone());

        let proposal_events_one = gov_contract
            .proposal_created_1_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut result = Vec::new();

        for p in proposal_events_one.iter() {
            let p = data_for_proposal_one(p.clone(), &op_rpc, dao_handler, gov_contract.clone())
                .await
                .context("data_for_proposal_one")?;
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

async fn data_for_proposal_one(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated1Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: optimism_gov_v6<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    println!("ProposalCreated1Filter");
    let (log, meta): (ProposalCreated1Filter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let voting_start_block_number = gov_contract
        .proposal_snapshot(log.proposal_id)
        .await
        .context("gov_contract.proposal_snapshot")
        .unwrap()
        .as_u64();

    let voting_end_block_number = gov_contract
        .proposal_deadline(log.proposal_id)
        .await
        .context("gov_contract.proposal_deadline")
        .unwrap()
        .as_u64();

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
        )
        .context("bad timestamp")?,
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
        )
        .context("bad timestamp")?,
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

    let body = log.description.to_string();

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", log.proposal_id);

    let proposal_external_id = log.proposal_id.to_string();

    let (against_votes, for_votes, abstain_votes) = gov_contract
        .proposal_votes(log.proposal_id)
        .await
        .context("voting_module.proposal_votes")?;

    let choices = vec!["For", "Against", "Abstain"];

    let scores: Vec<f64> = vec![
        for_votes.as_u128() as f64 / (10.0f64.powi(18)),
        against_votes.as_u128() as f64 / (10.0f64.powi(18)),
        abstain_votes.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .await
        .context("gov_contract.state")?;

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = scores_total;

    let quorum = gov_contract
        .quorum(log.proposal_id)
        .await
        .context("gov_contract.quorum")?
        .as_u128() as f64
        / (10.0f64.powi(18));

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
mod optimism_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV3};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn optimism_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::OpOptimismOld),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 115003910,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match OptimismType1Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "64861580915106728278960188313654044018229192803489945934331754023009986585740",
                    name: "Upgrade Proposal #3: Delta Network Upgrade ",
                    body_contains: vec!["This upgrade (“Delta”) contains a single consensus-layer feature, Span Batches."],
                    url: "https://vote.optimism.io/proposals/64861580915106728278960188313654044018229192803489945934331754023009986585740",
                    discussion_url:
                        "",
                    choices:  "[\"For\",\"Against\",\"Abstain\"]",
                    scores: "[47973168.65157966,17442.55720272951,4944.826909433364]",
                    scores_total: 47995556.03569182,
                    scores_quorum: 47995556.03569182,
                    quorum: 25500000.000000004,
                    proposal_state: ProposalStateEnum::Succeeded,
                    block_created: Some(115003910),
                    time_created: Some("2024-01-18 19:36:37"),
                    time_start: "2024-01-18 19:36:37",
                    time_end: "2024-01-24 19:36:37",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
