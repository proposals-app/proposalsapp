use crate::{ProposalHandler, ProposalsResult};
use abi::{decode, ParamType};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::{
    optimism_gov_v_6::{optimism_gov_v_6::optimism_gov_v6, ProposalCreated2Filter},
    optimism_token::optimism_token::optimism_token,
    optimism_votemodule_0xdd_022_9d_7_2a_41_4dc_82_1dec_6_6f_3cc_4ef_6db_2c_7b_7df,
};
use ethers::{prelude::*, utils::to_checksum};
use scanners::optimistic_scan::estimate_timestamp;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

pub struct OptimismType2Handler;

#[async_trait]
impl ProposalHandler for OptimismType2Handler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
        from_index: i32,
    ) -> Result<ProposalsResult> {
        let op_rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
        let op_rpc = Arc::new(Provider::<Http>::try_from(op_rpc_url).unwrap());

        let current_block = op_rpc
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

        let address = "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = optimism_gov_v6::new(address, op_rpc.clone());

        let token_address = "0x4200000000000000000000000000000000000042"
            .parse::<Address>()
            .context("bad address")?;

        let op_token = optimism_token::new(token_address, op_rpc.clone());

        let proposal_events_two = gov_contract
            .proposal_created_2_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut result = Vec::new();

        for p in proposal_events_two.iter() {
            let p = data_for_proposal_two(
                p.clone(),
                &op_rpc,
                dao_handler,
                gov_contract.clone(),
                op_token.clone(),
            )
            .await
            .context("data_for_proposal_two")?;
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

async fn data_for_proposal_two(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated2Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: optimism_gov_v6<ethers::providers::Provider<ethers::providers::Http>>,
    op_token: optimism_token<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    println!("ProposalCreated2Filter");
    let (log, meta): (ProposalCreated2Filter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let voting_start_block_number = log.start_block.as_u64();
    let voting_end_block_number = log.end_block.as_u64();

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 12 * 1000,
        )
        .context("bad timestamp")?,
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 12 * 1000,
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

    let voting_module = to_checksum(&log.voting_module, None);
    let proposal_type = log.proposal_type;

    let mut choices: Vec<&str> = vec![];
    let mut choices_strings: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    if voting_module == "0x27964c5f4F389B8399036e1076d84c6984576C33" {
        #[derive(Debug, Deserialize)]
        struct ProposalSettings {
            against_threshold: U256,
            is_relative_to_votable_supply: bool,
        }
        let mut supply = 0.0;
        let types: Vec<ParamType> = vec![ParamType::Tuple(vec![
            ParamType::Uint(256), // againstThreshold
            ParamType::Bool,      // isRelativeToVotableSupply
        ])];

        let decoded_proposal_data =
            decode(&types, &log.proposal_data).context("Failed to decode proposal data")?;

        let proposal_tokens = decoded_proposal_data[0].clone().into_tuple().unwrap();

        let proposal_settings = ProposalSettings {
            against_threshold: proposal_tokens[0].clone().into_uint().unwrap(),
            is_relative_to_votable_supply: proposal_tokens[1].clone().into_bool().unwrap(),
        };

        if proposal_settings.is_relative_to_votable_supply {
            let votable_supply = gov_contract
                .votable_supply_with_block_number(ethers::types::U256::from(
                    meta.block_number.as_u64(),
                ))
                .await?;

            supply = votable_supply.as_u128() as f64 / 10.0f64.powi(18);
        } else {
            let total_supply = op_token.total_supply().await?;

            supply = total_supply.as_u128() as f64 / 10.0f64.powi(18);
        }

        let (against_votes, _, _) = gov_contract.proposal_votes(log.proposal_id).await?;

        let for_votes = supply - against_votes.as_u128() as f64 / 10.0f64.powi(18);

        choices = vec!["Against", "For"];
        scores = vec![against_votes.as_u128() as f64 / 10.0f64.powi(18), for_votes];
        scores_total = scores.iter().sum();
    }

    if voting_module == "0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df" {
        let voting_module =
            optimism_votemodule_0xdd_022_9d_7_2a_41_4dc_82_1dec_6_6f_3cc_4ef_6db_2c_7b_7df::optimism_votemodule_0xdd0229d72a414dc821dec66f3cc4ef6db2c7b7df::new(
                log.voting_module,
                rpc.clone(),
            );

        #[derive(Debug, Deserialize)]
        struct ProposalOption {
            description: String,
        }

        #[derive(Debug, Deserialize)]
        struct ProposalData {
            proposal_options: Vec<ProposalOption>,
        }

        // Define the expected types
        let types: Vec<ParamType> = vec![
            ParamType::Array(Box::new(ParamType::Tuple(vec![
                ParamType::Uint(256),                             // budgetTokensSpent
                ParamType::Array(Box::new(ParamType::Address)),   // targets
                ParamType::Array(Box::new(ParamType::Uint(256))), // values
                ParamType::Array(Box::new(ParamType::Bytes)),     // calldatas
                ParamType::String,                                // description
            ]))),
            ParamType::Tuple(vec![
                ParamType::Uint(8),   // maxApprovals
                ParamType::Uint(8),   // criteria
                ParamType::Address,   // budgetToken
                ParamType::Uint(128), // criteriaValue
                ParamType::Uint(128), // budgetAmount
            ]),
        ];

        // Decode the bytes using the defined types
        let decoded_proposal_data = decode(&types, &log.proposal_data)?;

        // Extract the decoded data
        let proposal_options_tokens = decoded_proposal_data[0].clone().into_array().unwrap();

        // Parse proposal options
        let proposal_options: Vec<ProposalOption> = proposal_options_tokens
            .into_iter()
            .map(|token| {
                let tokens = token.into_tuple().unwrap();
                ProposalOption {
                    description: tokens[3].clone().into_string().unwrap(),
                }
            })
            .collect();

        // Construct the proposal data
        let proposal_data = ProposalData { proposal_options };

        choices_strings = proposal_data
            .proposal_options
            .iter()
            .map(|o| o.description.clone())
            .collect();

        choices = choices_strings.iter().map(|s| s.as_str()).collect();
    }

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .await
        .context("gov_contract.state")?;

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
        scores_quorum: Set(0.0),
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
        metadata: Set(
            json!({"proposal_type":proposal_type, "voting_module" : voting_module}).into(),
        ),
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
    async fn optimism_type_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::OpOptimismOld),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 115004187,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match OptimismType2Handler
            .get_proposals(&dao_handler, &dao, dao_handler.proposals_index)
            .await
        {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    name: "Summary of Code of Conduct enforcement decisions",
                    body_contains: vec!["The elected Token House Code of Conduct Council’s decisions are subject to optimistic approval by the Token House."],
                    url: "https://vote.optimism.io/proposals/114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    discussion_url:
                        "",
                    choices:  "[\"Against\",\"For\"]",
                    scores: "[2046807.8678072141,82953192.13219279]",
                    scores_total: 85000000.0,
                    scores_quorum: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Succeeded,
                    block_created: Some(115004187),
                    time_created: Some("2024-01-18 19:45:51"),
                    time_start: "2024-01-18 19:45:51",
                    time_end: "2024-01-24 19:45:51",
                    metadata: Some(json!({"proposal_type": 2, "voting_module": String::from("0x27964c5f4F389B8399036e1076d84c6984576C33")}))
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
