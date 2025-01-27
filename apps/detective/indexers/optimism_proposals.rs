use crate::{
    chain_data::{self, Chain},
    database::DatabaseStore,
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
};
use alloy::{
    dyn_abi::{DynSolType, DynSolValue},
    primitives::{address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use rust_decimal::{prelude::*, Decimal};
use sea_orm::{
    ActiveValue::{self, NotSet},
    ColumnTrait, Condition, EntityTrait, QueryFilter, Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
    vote,
};
use serde::Deserialize;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    optimism_gov_v_6,
    "./abis/optimism_gov_v6.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    optimism_token,
    "./abis/optimism_token.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    optimism_votemodule_0x27964c5f4F389B8399036e1076d84c6984576C33,
    "./abis/optimism_votemodule_0x27964c5f4F389B8399036e1076d84c6984576C33.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    optimism_votemodule_0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5,
    "./abis/optimism_votemodule_0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5.json"
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    optimism_votemodule_0xdd0229d72a414dc821dec66f3cc4ef6db2c7b7df,
    "./abis/optimism_votemodule_0xdd0229d72a414dc821dec66f3cc4ef6db2c7b7df.json"
);

pub struct OptimismProposalsIndexer;

#[async_trait]
impl Indexer for OptimismProposalsIndexer {
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
        IndexerVariant::OpOptimismProposals
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl ProposalsIndexer for OptimismProposalsIndexer {
    #[instrument(skip_all)]
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Optimism Proposals");

        let op_rpc = chain_data::get_chain_config(Chain::Optimism)?
            .provider
            .clone();

        let current_block = op_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("cDF27F107725988f2261Ce2256bDfCdE8B382B10");

        let gov_contract = optimism_gov_v_6::new(address, op_rpc.clone());

        let token_address = address!("4200000000000000000000000000000000000042");

        let op_token = optimism_token::new(token_address, op_rpc.clone());

        let mut proposals = Vec::new();

        // Process ProposalCreated1 events
        let proposal_events_zero = gov_contract
            .ProposalCreated_0_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .query()
            .await
            .context("query")?;

        for p in proposal_events_zero.iter() {
            let p = data_for_proposal_one(p.clone(), &op_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal_one")?;
            proposals.push(p);
        }

        // Process ProposalCreated2 events
        let proposal_events_two = gov_contract
            .ProposalCreated_1_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .query()
            .await
            .context("query")?;

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
            .ProposalCreated_2_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .query()
            .await
            .context("query")?;

        for p in proposal_events_three.iter() {
            let p = data_for_proposal_three(p.clone(), &op_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal_three")?;
            proposals.push(p);
        }

        // Process ProposalCreated4 events
        let proposal_events_four = gov_contract
            .ProposalCreated_3_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .query()
            .await
            .context("query")?;

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

        Ok(ProcessResult::Proposals(proposals, new_index))
    }
}

#[instrument(skip_all)]
async fn data_for_proposal_one(
    p: (optimism_gov_v_6::ProposalCreated_0, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v_6::optimism_gov_v_6Instance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log) = p;

    let created_block_number = log.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), BlockTransactionsKind::Hashes)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = gov_contract
        .proposalSnapshot(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_snapshot")?
        ._0
        .to::<u64>();

    let voting_end_block_number = gov_contract
        .proposalDeadline(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_deadline")?
        ._0
        .to::<u64>();

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
        };

    let voting_ends_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_end_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                created_block_timestamp * 1000
                    + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
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

    let body = event.description.to_string();

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", event.proposalId);

    let proposal_external_id = event.proposalId.to_string();

    let votes = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_votes")?;

    let choices = vec!["For", "Against", "Abstain"];

    let scores: Vec<f64> = vec![
        votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let proposal_state = gov_contract
        .state(event.proposalId)
        .call()
        .await
        .context("gov_contract.state")?
        ._0;

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = scores_total;

    let quorum = gov_contract
        .quorum(event.proposalId)
        .call()
        .await
        .context("gov_contract.quorum")?
        ._0
        .to::<u128>() as f64
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

    Ok(proposal::ActiveModel {
        id: ActiveValue::NotSet,
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
        marked_spam: ActiveValue::NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
        metadata: Set(
            json!({"proposal_type":1 , "voting_module":"", "vote_type":"unknown"}).into(),
        ),
    })
}

#[instrument(skip_all)]
async fn data_for_proposal_two(
    p: (optimism_gov_v_6::ProposalCreated_1, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v_6::optimism_gov_v_6Instance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
    op_token: optimism_token::optimism_tokenInstance<Http<reqwest::Client>, Arc<ReqwestProvider>>,
) -> Result<proposal::ActiveModel> {
    let db = DatabaseStore::connect().await?;
    let (event, log) = p;

    let created_block_number = log.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), BlockTransactionsKind::Hashes)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = event.startBlock.to::<u64>();
    let voting_end_block_number = event.endBlock.to::<u64>();

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64) * 12 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
        };

    let voting_ends_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_end_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                created_block_timestamp * 1000
                    + (voting_end_block_number - created_block_number) as i64 * 12 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
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

    let body = event.description.to_string();

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", event.proposalId);

    let proposal_external_id = event.proposalId.to_string();

    let voting_module = event.votingModule;
    let proposal_type = event.proposalType;

    let mut choices: Vec<&str> = vec![];
    let mut choices_strings: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    if voting_module == address!("27964c5f4F389B8399036e1076d84c6984576C33") {
        #[derive(Debug, Deserialize)]
        struct ProposalSettings {
            against_threshold: U256,
            is_relative_to_votable_supply: bool,
        }
        let mut proposal_settings = ProposalSettings {
            against_threshold: U256::from(0),
            is_relative_to_votable_supply: false,
        };

        #[allow(unused_assignments)]
        let mut supply = 0.0;

        let proposal_data_type = DynSolType::Tuple(vec![DynSolType::Uint(256), DynSolType::Bool]);
        let decoded: DynSolValue = proposal_data_type.abi_decode(&event.proposalData).unwrap();

        if let DynSolValue::Tuple(values) = decoded {
            proposal_settings.against_threshold = values[0].as_uint().unwrap().0;
            proposal_settings.is_relative_to_votable_supply = values[1].as_bool().unwrap();
        }

        if proposal_settings.is_relative_to_votable_supply {
            let votable_supply = gov_contract
                .votableSupply_1(U256::from(created_block_number))
                .call()
                .await?
                ._0;

            supply = votable_supply.to::<u128>() as f64 / 10.0f64.powi(18);
        } else {
            let total_supply = op_token.totalSupply().call().await?._0;

            supply = total_supply.to::<u128>() as f64 / 10.0f64.powi(18);
        }

        let votes = gov_contract.proposalVotes(event.proposalId).call().await?;

        let for_votes = supply - votes.againstVotes.to::<u128>() as f64 / 10.0f64.powi(18);

        choices = vec!["Against", "For"];
        scores = vec![
            votes.againstVotes.to::<u128>() as f64 / 10.0f64.powi(18),
            for_votes,
        ];
        scores_total = scores.iter().sum();
    }

    if voting_module == address!("dd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df") {
        let proposal_data_type = DynSolType::Tuple(vec![
            DynSolType::Array(Box::new(DynSolType::Tuple(vec![
                DynSolType::Uint(256),                              // budgetTokensSpent
                DynSolType::Array(Box::new(DynSolType::Address)),   // targets
                DynSolType::Array(Box::new(DynSolType::Uint(256))), // values
                DynSolType::Array(Box::new(DynSolType::Bytes)),     // calldatas
                DynSolType::String,                                 // description (choices)
            ]))),
            DynSolType::Tuple(vec![
                DynSolType::Uint(8),   // maxApprovals
                DynSolType::Uint(8),   // criteria
                DynSolType::Address,   // budgetToken
                DynSolType::Uint(128), // criteriaValue
                DynSolType::Uint(128), // budgetAmount
            ]),
        ]);

        let decoded = proposal_data_type
            .abi_decode_sequence(&event.proposalData)
            .map_err(|e| anyhow::anyhow!("Failed to decode proposal data: {:?}", e))?;

        if let DynSolValue::Tuple(outer_values) = decoded {
            if outer_values.len() == 2 {
                if let DynSolValue::Array(proposal_options) = &outer_values[0] {
                    for option in proposal_options {
                        if let DynSolValue::Tuple(option_values) = option {
                            if let DynSolValue::String(description) = &option_values[4] {
                                choices_strings.push(description.clone());
                            }
                        }
                    }
                    choices = choices_strings.iter().map(|s| s.as_str()).collect();
                }
            }
        }

        // Fetch votes and calculate scores
        let votes = vote::Entity::find()
            .filter(
                Condition::all()
                    .add(vote::Column::IndexerId.eq(indexer.id))
                    .add(vote::Column::ProposalExternalId.eq(event.proposalId.to_string())),
            )
            .all(&db)
            .await?;

        let mut choice_scores: Vec<Decimal> = vec![Decimal::ZERO; choices.len()];

        for vote in votes {
            let voting_power = Decimal::from_f64(vote.voting_power).unwrap_or(Decimal::ZERO);
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
        .state(event.proposalId)
        .call()
        .await
        .context("gov_contract.state")?
        ._0;

    let quorum = gov_contract
        .quorum(event.proposalId)
        .call()
        .await
        .context("gov_contract.quorum")?
        ._0
        .to::<u128>() as f64
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

    Ok(proposal::ActiveModel {
        id: ActiveValue::NotSet,
        external_id: Set(proposal_external_id),
        author: Set(Some(event.proposer.to_string())),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: NotSet,
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(0.0),
        quorum: Set(quorum),
        proposal_state: Set(state),
        marked_spam: ActiveValue::NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
        metadata: Set(
            json!({"proposal_type":proposal_type, "voting_module" : voting_module, "vote_type":"unknown"}).into(),
        ),
    })
}

#[instrument(skip_all)]
async fn data_for_proposal_three(
    p: (optimism_gov_v_6::ProposalCreated_2, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v_6::optimism_gov_v_6Instance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log) = p;

    let created_block_number = log.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), BlockTransactionsKind::Hashes)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = gov_contract
        .proposalSnapshot(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_snapshot")?
        ._0
        .to::<u64>();

    let voting_end_block_number = gov_contract
        .proposalDeadline(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_deadline")?
        ._0
        .to::<u64>();

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
        };

    let voting_ends_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_end_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                created_block_timestamp * 1000
                    + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
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

    let body = event.description.to_string();

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

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", event.proposalId);

    let proposal_external_id = event.proposalId.to_string();

    let voting_module = event.votingModule;

    let mut choices: Vec<&str> = vec![];
    let mut choices_strings: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    if voting_module == address!("54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5") {
        let voting_module = optimism_votemodule_0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5::new(
            event.votingModule,
            rpc.clone(),
        );

        let proposal_data_type = DynSolType::Tuple(vec![
            DynSolType::Array(Box::new(DynSolType::Tuple(vec![
                DynSolType::Array(Box::new(DynSolType::Address)), // targets
                DynSolType::Array(Box::new(DynSolType::Uint(256))), // values
                DynSolType::Array(Box::new(DynSolType::Bytes)),   // calldatas
                DynSolType::String,                               // description (choices)
            ]))),
            DynSolType::Tuple(vec![
                DynSolType::Uint(8),   // maxApprovals
                DynSolType::Uint(8),   // criteria
                DynSolType::Address,   // budgetToken
                DynSolType::Uint(128), // criteriaValue
                DynSolType::Uint(128), // budgetAmount
            ]),
        ]);

        let decoded = proposal_data_type
            .abi_decode_sequence(&event.proposalData)
            .map_err(|e| anyhow::anyhow!("Failed to decode proposal data: {:?}", e))?;

        if let DynSolValue::Tuple(outer_values) = decoded {
            if outer_values.len() == 2 {
                if let DynSolValue::Array(proposal_options) = &outer_values[0] {
                    for option in proposal_options {
                        if let DynSolValue::Tuple(option_values) = option {
                            if let DynSolValue::String(description) = &option_values[3] {
                                choices_strings.push(description.clone());
                            }
                        }
                    }
                    choices = choices_strings.iter().map(|s| s.as_str()).collect();
                }
            }
        }

        // Attempt to get votes
        match voting_module.proposalVotes(event.proposalId).call().await {
            Ok(votes) => {
                scores = votes
                    .optionVotes
                    .iter()
                    .map(|o| *o as f64 / (10.0f64.powi(18)))
                    .collect();
                scores_total = votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18));
            }
            Err(e) => println!("Failed to get proposal votes: {:?}", e),
        }
    }

    let scores_quorum = scores_total;

    let quorum = gov_contract
        .quorum(event.proposalId)
        .call()
        .await
        .context("gov_contract.quorum")?
        ._0
        .to::<u128>() as f64
        / (10.0f64.powi(18));

    Ok(proposal::ActiveModel {
        id: ActiveValue::NotSet,
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
        marked_spam: ActiveValue::NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
        metadata: Set(
            json!({"proposal_type":3, "voting_module" : voting_module, "vote_type":"unknown"})
                .into(),
        ),
    })
}

#[instrument(skip_all)]
async fn data_for_proposal_four(
    p: (optimism_gov_v_6::ProposalCreated_3, Log),
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
    gov_contract: optimism_gov_v_6::optimism_gov_v_6Instance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<proposal::ActiveModel> {
    let (event, log) = p;

    let created_block_number = log.block_number.unwrap();
    let created_block = rpc
        .get_block_by_number(created_block_number.into(), BlockTransactionsKind::Hashes)
        .await
        .context("get_block_by_number")?
        .unwrap();
    let created_block_timestamp = created_block.header.timestamp as i64;

    let voting_start_block_number = gov_contract
        .proposalSnapshot(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_snapshot")?
        ._0
        .to::<u64>();

    let voting_end_block_number = gov_contract
        .proposalDeadline(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_deadline")?
        ._0
        .to::<u64>();

    let voting_starts_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_start_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                (created_block_timestamp * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
        };

    let voting_ends_timestamp =
        match chain_data::estimate_timestamp(Chain::Optimism, voting_end_block_number).await {
            Ok(r) => r,
            Err(_) => DateTime::from_timestamp_millis(
                created_block_timestamp * 1000
                    + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
            )
            .context("bad timestamp")?
            .naive_utc(),
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

    let body = event.description.to_string();

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", event.proposalId);

    let proposal_external_id = event.proposalId.to_string();

    let votes = gov_contract
        .proposalVotes(event.proposalId)
        .call()
        .await
        .context("gov_contract.proposal_votes")?;

    let choices = vec!["Against", "For", "Abstain"];

    let scores: Vec<f64> = vec![
        votes.againstVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        votes.forVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
        votes.abstainVotes.to::<u128>() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total: f64 = scores.iter().sum();

    let scores_quorum = scores_total;

    let quorum = gov_contract
        .quorum(event.proposalId)
        .call()
        .await
        .context("gov_contract.quorum")?
        ._0
        .to::<u128>() as f64
        / (10.0f64.powi(18));

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

    Ok(proposal::ActiveModel {
        id: ActiveValue::NotSet,
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
        marked_spam: ActiveValue::NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(DateTime::from_timestamp(created_block_timestamp, 0)
            .unwrap()
            .naive_utc()),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(created_block_number as i32),
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(log.transaction_hash.unwrap())
        ))),
        metadata: Set(json!({"proposal_type":4, "voting_module":"", "vote_type":"unknown"}).into()),
    })
}

#[cfg(test)]
mod optimism_proposals_tests {
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 72973366,
                    external_id: "103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    name: "Test Vote 3: All Together Now -- Come try out the new vote.optimism.io!",
                    body_contains: Some(vec!["Test Vote 3: All Together Now -- Come try out the new vote.optimism.io!"]),
                    url: "https://vote.optimism.io/proposals/103606400798595803012644966342403441743733355496979747669804254618774477345292",
                    discussion_url: None,
                    choices: json!(["Against", "For", "Abstain"]),
                    scores: json!([125585.89585173706, 8272364.31425079, 1642587.183320581]),
                    scores_total: 10040537.393423107,
                    scores_quorum: 10040537.393423107,
                    quorum: 1288490188.8,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-02-08 16:12:11"),
                    time_start: parse_datetime("2023-02-08 16:35:43"),
                    time_end: parse_datetime("2023-02-20 07:16:50"),
                    block_created: Some(72973366),
                    txid: Some("0x76a30154da5f71854459a81106d0aaea2c21a2b515795c5b30395fd3c4cd71f9"),
                    metadata: Some(json!({"proposal_type": 4, "voting_module":"", "vote_type":"unknown"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 110769479,
                    external_id: "25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    name: " Code of Conduct Violation: Carlos Melgar",
                    body_contains: Some(vec!["All active delegates, badgeholders, Citizens, and grant recipients"]),
                    url: "https://vote.optimism.io/proposals/25353629475948605098820168047140307200589226219380649297323431722674892706917",
                    discussion_url: None,
                    choices: json!(["Against", "For", "Abstain"]),
                    scores: json!([15216557.165632907, 2250417.3066406273, 27080684.7233773]),
                    scores_total: 44547659.19565083,
                    scores_quorum: 44547659.19565083,
                    quorum: 1288490188.799956,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-10-12 19:08:55"),
                    time_start: parse_datetime("2023-10-12 19:08:55"),
                    time_end: parse_datetime("2023-10-25 19:15:55"),
                    block_created: Some(110769479),
                    txid: Some("0xcf90a49173d2e69f5b4848a1070da6fe26feadc7ec943597e6fcbd1694b12c26"),
                    metadata: Some(json!({"proposal_type": 4, "voting_module":"", "vote_type":"unknown"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 99601892,
                    external_id: "2808108363564117434228597137832979672586627356483314020876637262618986508713",
                    name: "Council Reviewer Elections: Builders Grants",
                    body_contains: Some(vec!["Following the approval of the Grants Council Intent Budget, the Token House will elect 3 Reviewers to the Builders sub-committee."]),
                    url: "https://vote.optimism.io/proposals/2808108363564117434228597137832979672586627356483314020876637262618986508713",
                    discussion_url: None,
                    choices: json!(["Gonna.eth", "Jack Anorak", "Krzysztof Urbanski (kaereste or krst)", "Oxytocin"]),
                    scores: json!([11142667.865487626, 16494041.841187937, 17058726.359085575, 3335841.0624760245]),
                    scores_total: 19550751.716870543,
                    scores_quorum: 19550751.716870543,
                    quorum: 1288490188.8,
                    proposal_state: ProposalState::Defeated,
                    marked_spam: None,
                    time_created: parse_datetime("2023-05-18 20:32:12"),
                    time_start: parse_datetime("2023-05-18 20:32:12"),
                    time_end: parse_datetime("2023-05-31 23:43:30"),
                    block_created: Some(99601892),
                    txid: Some("0x466d42503a7158c027c6b3073b07af2addf14ab05e3400208e2344482f10da67"),
                    metadata: Some(json!({"proposal_type": 3, "voting_module":"0x54a8fcbbf05ac14bef782a2060a8c752c7cc13a5", "vote_type":"unknown"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 111677431,
                    external_id: "47209512763162691916934752283791420767969951049918368296503715012448877295335",
                    name: "Elect Token House Code of Conduct Council Members",
                    body_contains: Some(vec!["Season 5 will further decentralize the Foundation's role in processing violations of the Code of Conduct and remove enforcement responsibility from Token House delegates by electing a Code of Conduct Council."]),
                    url: "https://vote.optimism.io/proposals/47209512763162691916934752283791420767969951049918368296503715012448877295335",
                    discussion_url: None,
                    choices: json!(["Juankbell", "Teresacd", "Oxytocin", "Axel_T", "Gene", "Juanbug_PGov", "Bubli.eth", "Ayohtunde"]),
                    scores: json!([42170.51198003142, 42170.51198003142, 0.0, 0.0, 0.0, 44259.10599675262, 0.0, 0.0]),
                    scores_total: 44259.10599675262,
                    scores_quorum: 44259.10599675262,
                    quorum: 1288490188.799956,
                    proposal_state: ProposalState::Canceled,
                    marked_spam: None,
                    time_created: parse_datetime("2023-11-02 19:33:59"),
                    time_start: parse_datetime("2023-11-02 19:33:59"),
                    time_end: parse_datetime("2023-11-15 19:53:59"),
                    block_created: Some(111677431),
                    txid: Some("0x2afa238e1a4928980781fabf2bca2229a8b860d217f21e8b904bc23a7d124bec"),
                    metadata: Some(json!({"proposal_type": 3, "voting_module":"0x54a8fcbbf05ac14bef782a2060a8c752c7cc13a5", "vote_type":"unknown"})),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 115004187,
                    external_id: "114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    name: "Summary of Code of Conduct enforcement decisions",
                    body_contains: Some(vec!["The elected Token House Code of Conduct Council’s decisions are subject to optimistic approval by the Token House."]),
                    url: "https://vote.optimism.io/proposals/114318499951173425640219752344574142419220609526557632733105006940618608635406",
                    discussion_url: None,
                    choices: json!(["Against", "For"]),
                    scores: json!([2046807.8678072141, 82953192.13219279]),
                    scores_total: 85000000.0,
                    scores_quorum: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-01-18 19:45:51"),
                    time_start: parse_datetime("2024-01-18 19:45:51"),
                    time_end: parse_datetime("2024-01-24 19:45:51"),
                    block_created: Some(115004187),
                    txid: Some("0x614f36d22c7d5a84262628c28d191abccf80f41f91778562ad4a23e42e3dd916"),
                    metadata: Some(json!({"proposal_type": 2, "voting_module":"0x27964c5f4f389b8399036e1076d84c6984576c33", "vote_type":"unknown"})),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 115004502,
                    external_id: "85201803452801064488010899743776233282327928046183497710694797613625563092117",
                    name: "Summary of Code of Conduct enforcement decisions",
                    body_contains: Some(vec!["The elected Token House Code of Conduct Council’s decisions are subject to optimistic approval by the Token House."]),
                    url: "https://vote.optimism.io/proposals/85201803452801064488010899743776233282327928046183497710694797613625563092117",
                    discussion_url: None,
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
                    metadata: Some(json!({"proposal_type": 2, "voting_module":"0x27964c5f4f389b8399036e1076d84c6984576c33", "vote_type":"unknown"})),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 115911400,
                    external_id: "110421945337145674755337791449307926523882947474955336225598126770999669868176",
                    name: "Mission Requests: Intent #1 1.33M OP",
                    body_contains: Some(vec!["In Season 5, the Token House will approval rank Mission Requests that work towards our Collective Intents. "]),
                    url: "https://vote.optimism.io/proposals/110421945337145674755337791449307926523882947474955336225598126770999669868176",
                    discussion_url: None,
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
                    metadata: Some(json!({"proposal_type": 0, "voting_module":"0xdd0229d72a414dc821dec66f3cc4ef6db2c7b7df", "vote_type":"unknown"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
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
            updated_at: chrono::Utc::now().naive_utc(),
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

        match OptimismProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 121357490,
                    external_id: "14140470239376219798070786387548096572382469675815006174305459677010858217673",
                    name: "Developer Advisory Board Elections",
                    body_contains: Some(vec!["Following the approval of the Developer Advisory Board Operating Budget, the Token House will elect 5 Developer Advisory Board members,"]),
                    url: "https://vote.optimism.io/proposals/14140470239376219798070786387548096572382469675815006174305459677010858217673",
                    discussion_url: None,
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
                    metadata: Some(json!({"proposal_type": 0, "voting_module":"0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df", "vote_type":"unknown"})),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
