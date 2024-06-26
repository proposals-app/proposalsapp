use crate::ChainVotesResult;
use anyhow::{Context, Result};
use contracts::gen::aave_v_2_gov::aave_v2_gov;
use contracts::gen::aave_v_2_gov::VoteEmittedFilter;
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

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
}

pub async fn aave_v2_votes(dao_handler: &dao_handler::Model) -> Result<ChainVotesResult> {
    let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
    let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

    let current_block = eth_rpc
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

    let gov_contract = aave_v2_gov::new(address, eth_rpc);

    let logs = gov_contract
        .vote_emitted_filter()
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("bad query")?;

    let votes = get_votes(logs.clone(), dao_handler).context("bad votes")?;

    Ok(ChainVotesResult {
        votes,
        to_index: Some(to_block as i32),
    })
}

fn get_votes(
    logs: Vec<(VoteEmittedFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteEmittedFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.voting_power.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                true => 0.into(),
                false => 1.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.id.to_string()),
            dao_id: Set(dao_handler.dao_id.clone()),
            dao_handler_id: Set(dao_handler.id.clone()),
            ..Default::default()
        })
    }

    Ok(votes)
}
