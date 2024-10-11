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

        let db = DatabaseStore::connect().await?;

        for p in proposal_events_two.iter() {
            let p = data_for_proposal_two(
                p.clone(),
                &op_rpc,
                indexer,
                gov_contract.clone(),
                op_token.clone(),
                &db,
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

        Ok((proposals, Vec::new(), to_block))
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
    db: &DatabaseConnection,
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
            .all(db)
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
