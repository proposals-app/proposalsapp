use crate::database::DatabaseStore;
use crate::indexer::Indexer;
use crate::rpc_providers;
use ::utils::errors::DATABASE_ERROR;
use abi::decode;
use abi::ParamType;
use anyhow::{Context, Result};
use chrono::DateTime;
use contracts::gen::optimism_gov_v_6::ProposalCreated3Filter;
use contracts::gen::optimism_gov_v_6::ProposalCreated4Filter;
use contracts::gen::optimism_gov_v_6::{ProposalCreated1Filter, ProposalCreated2Filter};
use contracts::gen::optimism_votemodule_0x_54a_8f_cb_bf_0_5ac_1_4b_ef_78_2a_2060a8c752c7cc1_3a_5;
use contracts::gen::{
    optimism_gov_v_6::optimism_gov_v6, optimism_token::optimism_token::optimism_token,
};
use ethers::prelude::*;
use ethers::utils::to_checksum;
use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use scanners::optimistic_scan::estimate_timestamp;
use sea_orm::ActiveValue;
use sea_orm::ColumnTrait;
use sea_orm::Condition;
use sea_orm::DatabaseConnection;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tracing::info;

pub struct OptimismProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for OptimismProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Optimism Proposals");

        let op_rpc = rpc_providers::get_provider("optimism")?;

        let current_block = op_rpc
            .get_block_number()
            .await
            .context("get_block_number")?
            .as_u32() as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = optimism_gov_v6::new(address, op_rpc.clone());

        let token_address = "0x4200000000000000000000000000000000000042"
            .parse::<Address>()
            .context("bad address")?;

        let op_token = optimism_token::new(token_address, op_rpc.clone());

        let mut proposals = Vec::new();

        // Process ProposalCreated1 events
        let proposal_events_one = gov_contract
            .proposal_created_1_filter()
            .from_block(from_block)
            .to_block(to_block)
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        for p in proposal_events_one.iter() {
            let p = data_for_proposal_one(p.clone(), &op_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal_one")?;
            proposals.push(p);
        }

        // Process ProposalCreated2 events
        let proposal_events_two = gov_contract
            .proposal_created_2_filter()
            .from_block(from_block)
            .to_block(to_block)
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        for p in proposal_events_two.iter() {
            let p = data_for_proposal_two(
                p.clone(),
                &op_rpc,
                indexer,
                gov_contract.clone(),
                op_token.clone(),
            )
            .await
            .context("data_for_proposal_two")?;
            proposals.push(p);
        }

        // Process ProposalCreated3 events
        let proposal_events_three = gov_contract
            .proposal_created_3_filter()
            .from_block(from_block)
            .to_block(to_block)
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        for p in proposal_events_three.iter() {
            let p = data_for_proposal_three(p.clone(), &op_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal_three")?;
            proposals.push(p);
        }

        // Process ProposalCreated4 events
        let proposal_events_four = gov_contract
            .proposal_created_4_filter()
            .from_block(from_block)
            .to_block(to_block)
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        for p in proposal_events_four.iter() {
            let p = data_for_proposal_four(p.clone(), &op_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal_four")?;
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
        10_000_000
    }
}

async fn data_for_proposal_one(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated1Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
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
        Err(_) => DateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        Err(_) => DateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
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
        .context("gov_contract.proposal_votes")?;

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
        marked_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.as_bytes())
        ))),
        metadata: Set(json!({"proposal_type":1 , "voting_module":""}).into()),
    })
}

async fn data_for_proposal_two(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated2Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v6<ethers::providers::Provider<ethers::providers::Http>>,
    op_token: optimism_token<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    println!("ProposalCreated2Filter");
    let db = DatabaseStore::connect().await?;
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
        Err(_) => DateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 12 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,

        Err(_) => DateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 12 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
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
                    description: tokens[4].clone().into_string().unwrap(),
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

        //TODO: this only considers for votes
        //      against and abstain should be handled somehow as well

        choices = choices_strings.iter().map(|s| s.as_str()).collect();

        scores = choices_strings.iter().map(|_s| 0.0).collect();

        // Fetch all votes for this proposal
        let votes = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::IndexerId.eq(indexer.id))
                    .add(vote::Column::ProposalExternalId.eq(proposal_external_id.clone())),
            )
            .all(&db)
            .await
            .context(DATABASE_ERROR)?;

        // Initialize a vector to store scores for each choice
        let mut choice_scores: Vec<Decimal> = vec![Decimal::ZERO; choices_strings.len()];

        // Process votes and accumulate scores
        for vote in votes {
            let voting_power = Decimal::from_f64(vote.voting_power).unwrap_or(Decimal::ZERO);
            // if let Some(index) = vote.choice.as_i64() {
            //     if index >= 0 && (index as usize) < choice_scores.len() {
            //         choice_scores[index as usize] += voting_power;
            //     }
            // } else
            if let Some(indices) = vote.choice.as_array() {
                for value in indices {
                    if let Some(index) = value.as_i64() {
                        if index >= 0 && (index as usize) < choice_scores.len() {
                            choice_scores[index as usize] += voting_power;
                        }
                    }
                }
            }
        }

        scores = choice_scores
            .iter()
            .map(|&score| score.to_f64().unwrap_or(0.0))
            .collect();
        scores_total = choice_scores
            .iter()
            .sum::<Decimal>()
            .to_f64()
            .unwrap_or(0.0);
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
        marked_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.as_bytes())
        ))),
        metadata: Set(
            json!({"proposal_type":proposal_type, "voting_module" : voting_module}).into(),
        ),
    })
}

async fn data_for_proposal_three(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated3Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v6<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    println!("ProposalCreated3Filter");
    let (log, meta): (ProposalCreated3Filter, LogMeta) = p.clone();

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

        Err(_) => DateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,

        Err(_) => DateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
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

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .await
        .context("gov_contract.state")?;

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

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", log.proposal_id);

    let proposal_external_id = log.proposal_id.to_string();

    let voting_module = to_checksum(&log.voting_module, None);

    let mut choices: Vec<&str> = vec![];
    let mut choices_strings: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    if voting_module == "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5" {
        let voting_module =
            optimism_votemodule_0x_54a_8f_cb_bf_0_5ac_1_4b_ef_78_2a_2060a8c752c7cc1_3a_5::optimism_votemodule_0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5::new(
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
                ParamType::Array(Box::new(ParamType::Address)), // targets
                ParamType::Array(Box::new(ParamType::Uint(256))), // values
                ParamType::Array(Box::new(ParamType::Bytes)),   // calldatas
                ParamType::String,                              // description
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

        let votes = voting_module
            .proposal_votes(log.proposal_id)
            .await
            .context("voting_module.proposal_votes")?;

        //TODO: this only considers for votes
        //      against and abstain should be handled somehow as well
        //      this happens in .0 and .1

        scores = votes
            .2
            .iter()
            .map(|o| *o as f64 / (10.0f64.powi(18)))
            .collect();

        scores_total = votes.0.as_u128() as f64 / (10.0f64.powi(18));
    }

    let scores_quorum = scores_total;

    let quorum = gov_contract
        .quorum(log.proposal_id)
        .await
        .context("gov_contract.quorum")?
        .as_u128() as f64
        / (10.0f64.powi(18));

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
        marked_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.as_bytes())
        ))),
        metadata: Set(json!({"proposal_type":3, "voting_module" : voting_module}).into()),
    })
}

async fn data_for_proposal_four(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated4Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v6<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    println!("ProposalCreated4Filter");
    let (log, meta): (ProposalCreated4Filter, LogMeta) = p.clone();

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
        Err(_) => DateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        Err(_) => DateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
        )
        .context("bad timestamp")?
        .naive_utc(),
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
        .context("gov_contract.proposal_votes")?;

    let choices = vec!["Against", "For", "Abstain"];

    let scores: Vec<f64> = vec![
        against_votes.as_u128() as f64 / (10.0f64.powi(18)),
        for_votes.as_u128() as f64 / (10.0f64.powi(18)),
        abstain_votes.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = scores_total;

    let quorum = gov_contract
        .quorum(log.proposal_id)
        .await
        .context("gov_contract.quorum")?
        .as_u128() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .await
        .context("gov_contract.state")?;

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
        marked_spam: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(created_block_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.as_bytes())
        ))),
        metadata: Set(json!({"proposal_type":4, "voting_module":""}).into()),
    })
}

#[cfg(test)]
mod optimism_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn optimism_proposals_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 72973366,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 72973366,
                    external_id: "103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    name: "Test Vote 3: All Together Now -- Come try out the new vote.optimism.io!",
                    body_contains: Some(vec!["Test Vote 3: All Together Now -- Come try out the new vote.optimism.io!"]),
                    url: "https://vote.optimism.io/proposals/103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    discussion_url: "",
                    choices: json!(["Against", "For", "Abstain"]),
                    scores: json!([125585.89585173706, 8272364.31425079, 1642587.183320581]),
                    scores_total: 10040537.393423107,
                    scores_quorum: 10040537.393423107,
                    quorum: 6399501.27104,
                    proposal_state: ProposalState::Succeeded,
                    marked_spam: None,
                    time_created: parse_datetime("2023-02-08 16:12:11"),
                    time_start: parse_datetime("2023-02-08 16:35:43"),
                    time_end: parse_datetime("2023-02-20 07:16:50"),
                    block_created: Some(72973366),
                    txid: Some("0x76a30154da5f71854459a81106d0aaea2c21a2b515795c5b30395fd3c4cd71f9"),
                    metadata: Some(json!({"proposal_type": 4, "voting_module":""})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_proposals_2() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 110769479,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 110769479,
                    external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    name: " Code of Conduct Violation: Carlos Melgar",
                    body_contains: Some(vec!["All active delegates, badgeholders, Citizens, and grant recipients"]),
                    url: "https://vote.optimism.io/proposals/25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    discussion_url: "",
                    choices: json!(["Against", "For", "Abstain"]),
                    scores: json!([15216557.165632907, 2250417.3066406273, 27080684.7233773]),
                    scores_total: 44547659.19565083,
                    scores_quorum: 44547659.19565083,
                    quorum: 21131239.096319277,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-10-12 19:08:55"),
                    time_start: parse_datetime("2023-10-12 19:08:55"),
                    time_end: parse_datetime("2023-10-25 19:15:55"),
                    block_created: Some(110769479),
                    txid: Some("0xcf90a49173d2e69f5b4848a1070da6fe26feadc7ec943597e6fcbd1694b12c26"),
                    metadata: Some(json!({"proposal_type": 4, "voting_module":""})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_proposals_3() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 99601892,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 99601892,
                    external_id: "2808108363564117434228597137832979672586627356483314020876637262618986508713",
                    name: "Council Reviewer Elections: Builders Grants",
                    body_contains: Some(vec!["Following the approval of the Grants Council Intent Budget, the Token House will elect 3 Reviewers to the Builders sub-committee."]),
                    url: "https://vote.optimism.io/proposals/2808108363564117434228597137832979672586627356483314020876637262618986508713",
                    discussion_url: "",
                    choices: json!(["Gonna.eth", "Jack Anorak", "Krzysztof Urbanski (kaereste or krst)", "Oxytocin"]),
                    scores: json!([11142667.865487626, 16494041.841187937, 17058726.359085575, 3335841.0624760245]),
                    scores_total: 19550751.716870543,
                    scores_quorum: 19550751.716870543,
                    quorum: 11854109.73696,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-05-18 20:32:12"),
                    time_start: parse_datetime("2023-05-18 20:32:12"),
                    time_end: parse_datetime("2023-05-31 23:43:30"),
                    block_created: Some(99601892),
                    txid: Some("0x466d42503a7158c027c6b3073b07af2addf14ab05e3400208e2344482f10da67"),
                    metadata: Some(json!({"proposal_type": 3, "voting_module":"0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn optimism_proposals_4() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 111677431,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 111677431,
                    external_id: "47209512763162691916934752283791420767969951049918368296503715012448877295335",
                    name: "Elect Token House Code of Conduct Council Members",
                    body_contains: Some(vec!["Season 5 will further decentralize the Foundation's role in processing violations of the Code of Conduct and remove enforcement responsibility from Token House delegates by electing a Code of Conduct Council."]),
                    url: "https://vote.optimism.io/proposals/47209512763162691916934752283791420767969951049918368296503715012448877295335",
                    discussion_url: "",
                    choices: json!(["Juankbell", "Teresacd", "Oxytocin", "Axel_T", "Gene", "Juanbug_PGov", "Bubli.eth", "Ayohtunde"]),
                    scores: json!([42170.51198003142, 42170.51198003142, 0.0, 0.0, 0.0, 44259.10599675262, 0.0, 0.0]),
                    scores_total: 44259.10599675262,
                    scores_quorum: 44259.10599675262,
                    quorum: 24094766.53055918,
                    proposal_state: ProposalState::Canceled,
                    marked_spam: None,
                    time_created: parse_datetime("2023-11-02 19:33:59"),
                    time_start: parse_datetime("2023-11-02 19:33:59"),
                    time_end: parse_datetime("2023-11-15 19:53:59"),
                    block_created: Some(111677431),
                    txid: Some("0x2afa238e1a4928980781fabf2bca2229a8b860d217f21e8b904bc23a7d124bec"),
                    metadata: Some(json!({"proposal_type": 3, "voting_module":"0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_proposals_5() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 115004187,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 115004187,
                    external_id: "114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    name: "Summary of Code of Conduct enforcement decisions",
                    body_contains: Some(vec!["The elected Token House Code of Conduct Council’s decisions are subject to optimistic approval by the Token House."]),
                    url: "https://vote.optimism.io/proposals/114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    discussion_url: "",
                    choices: json!(["Against", "For"]),
                    scores: json!([2046807.8678072141, 82953192.13219279]),
                    scores_total: 85000000.0,
                    scores_quorum: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalState::Succeeded,
                    marked_spam: None,
                    time_created: parse_datetime("2024-01-18 19:45:51"),
                    time_start: parse_datetime("2024-01-18 19:45:51"),
                    time_end: parse_datetime("2024-01-24 19:45:51"),
                    block_created: Some(115004187),
                    txid: Some("0x614f36d22c7d5a84262628c28d191abccf80f41f91778562ad4a23e42e3dd916"),
                    metadata: Some(json!({"proposal_type": 2, "voting_module":"0x27964c5f4F389B8399036e1076d84c6984576C33"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_proposals_6() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 115004502,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 115004502,
                    external_id: "85201803452801064488010899743776233282327928046183497710694797613625563092117",
                    name: "Summary of Code of Conduct enforcement decisions",
                    body_contains: Some(vec!["The elected Token House Code of Conduct Council’s decisions are subject to optimistic approval by the Token House."]),
                    url: "https://vote.optimism.io/proposals/85201803452801064488010899743776233282327928046183497710694797613625563092117",
                    discussion_url: "",
                    choices: json!(["Against", "For"]),
                    scores: json!([107.67718007543513, 84999892.32281992]),
                    scores_total: 85000000.0,
                    scores_quorum: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalState::Canceled,
                    marked_spam: None,
                    time_created: parse_datetime("2024-01-18 19:56:21"),
                    time_start: parse_datetime("2024-01-18 19:56:21"),
                    time_end: parse_datetime("2024-01-24 19:56:21"),
                    block_created: Some(115004502),
                    txid: Some("0xe9e68c1ca2c4e4678d3e6afc397fa56c8c1dc25359818f0ca7e4b7775e64a55a"),
                    metadata: Some(json!({"proposal_type": 2, "voting_module":"0x27964c5f4F389B8399036e1076d84c6984576C33"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn optimism_proposals_7() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 115911400,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 115911400,
                    external_id: "110421945337145674755337791449307926523882947474955336225598126770999669868176",
                    name: "Mission Requests: Intent #1 1.33M OP",
                    body_contains: Some(vec!["In Season 5, the Token House will approval rank Mission Requests that work towards our Collective Intents. "]),
                    url: "https://vote.optimism.io/proposals/110421945337145674755337791449307926523882947474955336225598126770999669868176",
                    discussion_url: "",
                    choices: json!(["Request 1A: Alternative CL/EL client Mission Request", "Request 1B: Decentralized rollup-as-a-service", "Request 1C: Fraud Proof CTF Mission Request", "Request 1D: Implement a prototype of an OP stack chain with mempool encryption", "Request 1E: OP Stack Research and Implementation", "Request 1F: Open Source OP Stack Developer Tooling"]),
                    scores: json!([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
                    scores_total: 0.0,
                    scores_quorum: 0.0,
                    quorum: 26571000.0,
                    proposal_state: ProposalState::Canceled,
                    marked_spam: None,
                    time_created: parse_datetime("2024-02-08 19:46:17"),
                    time_start: parse_datetime("2024-02-08 19:46:17"),
                    time_end: parse_datetime("2024-02-14 19:46:17"),
                    block_created: Some(115911400),
                    txid: Some("0x53426a899aea57645c3205f927f6e26fe6c2e64659a0788e46d5f57fb0175dee"),
                    metadata: Some(json!({"proposal_type": 0, "voting_module":"0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[ignore = "needs votes in the db first"]
    #[tokio::test]
    async fn optimism_proposals_8() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::OpOptimismProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 121357490,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Optimism".into(),
            slug: "optimism".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match OptimismProposalsIndexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 121357490,
                    external_id: "14140470239376219798070786387548096572382469675815006174305459677010858217673",
                    name: "Developer Advisory Board Elections",
                    body_contains: Some(vec!["Following the approval of the Developer Advisory Board Operating Budget, the Token House will elect 5 Developer Advisory Board members,"]),
                    url: "https://vote.optimism.io/proposals/14140470239376219798070786387548096572382469675815006174305459677010858217673",
                    discussion_url: "",
                    choices: json!(["devtooligan", "wildmolasses", "wbnns", "bytes032", "Jepsen", "blockdev", "anika", "merklefruit", "gmhacker", "jtriley.eth", "shekhirin", "philogy", "noah.eth", "chom", "0xleastwood", "alextnetto.eth"]),
                    scores: json!([36155472.21699658, 37768955.76294833, 21597099.60182954, 1419736.9182661003, 6783434.125136958, 31310623.187509544, 19660002.048630036, 6144795.035171971, 1254269.9047496044, 8428675.963217337, 2553125.3378252042, 10421644.106879342, 23506901.941835452, 1251657.9060459752, 156661.76426312412, 18239800.25168079]),
                    scores_total: 226652856.0729859,
                    scores_quorum: 0.0,
                    quorum: 26226000.0,
                    proposal_state: ProposalState::Succeeded,
                    marked_spam: None,
                    time_created: parse_datetime("2024-06-13 21:22:37"),
                    time_start: parse_datetime("2024-06-13 21:22:37"),
                    time_end: parse_datetime("2024-06-19 21:22:37"),
                    block_created: Some(121357490),
                    txid: Some("0x4a8d10f7b38813df916a48d2e24c576f08e8bc43bf7c7a5c5c1977d5c9df3baa"),
                    metadata: Some(json!({"proposal_type": 0, "voting_module":"0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
