use crate::ChainVotesResult;
use anyhow::{Context, Result};
use contracts::gen::optimism_gov_v_6::optimism_gov_v_6::optimism_gov_v6;
use contracts::gen::optimism_gov_v_6::{VoteCastFilter, VoteCastWithParamsFilter};
use ethers::prelude::Http;
use ethers::prelude::LogMeta;
use ethers::prelude::Provider;
use ethers::providers::Middleware;
use ethers::types::Address;
use ethers::utils::to_checksum;
use sea_orm::NotSet;
use sea_orm::Set;
use seaorm::{dao_handler, vote};
use serde::Deserialize;
use std::sync::Arc;
use tracing::instrument;

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
}

#[instrument(skip_all)]
pub async fn optimism_votes(dao_handler: &dao_handler::Model) -> Result<ChainVotesResult> {
    let op_rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
    let op_rpc = Arc::new(Provider::<Http>::try_from(op_rpc_url).unwrap());

    let current_block = op_rpc
        .get_block_number()
        .await
        .context("bad current block")?
        .as_u64();

    let from_block = dao_handler.votes_index as u64;
    let to_block = if dao_handler.votes_index as u64 + dao_handler.votes_refresh_speed as u64
        > current_block
    {
        current_block
    } else {
        dao_handler.votes_index as u64 + dao_handler.votes_refresh_speed as u64
    };

    let decoder: Decoder =
        serde_json::from_value(dao_handler.clone().decoder).context("bad decoder")?;

    let address = decoder.address.parse::<Address>().context("bad address")?;

    let gov_contract = optimism_gov_v6::new(address, op_rpc);

    let logs = gov_contract
        .vote_cast_filter()
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("bad query")?;

    let logs_with_params = gov_contract
        .vote_cast_with_params_filter()
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("bad query")?;

    let votes = get_votes(logs.clone(), dao_handler).context("bad votes")?;
    let votes_with_params =
        get_votes_with_params(logs_with_params.clone(), dao_handler).context("bad votes")?;

    let all_votes = [votes, votes_with_params].concat();

    Ok(ChainVotesResult {
        votes: all_votes,
        to_index: Some(to_block as i64),
    })
}

#[instrument(skip_all)]
fn get_votes(
    logs: Vec<(VoteCastFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i64),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i64)),
            choice: Set(log.support.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id.clone()),
            dao_handler_id: Set(dao_handler.id.clone()),
            reason: Set(Some(log.reason)),
            ..Default::default()
        })
    }

    Ok(votes)
}

#[instrument(skip_all)]
fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParamsFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i64),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i64)),
            choice: Set(log.support.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id.clone()),
            dao_handler_id: Set(dao_handler.id.clone()),
            reason: Set(Some(log.reason)),
            ..Default::default()
        })
    }

    Ok(votes)
}
