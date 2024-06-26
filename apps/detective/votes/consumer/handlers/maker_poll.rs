use crate::ChainVotesResult;
use anyhow::{Context, Result};
use contracts::gen::maker_poll_vote::maker_poll_vote::maker_poll_vote;
use contracts::gen::maker_poll_vote::VotedFilter;
use ethers::prelude::Http;
use ethers::prelude::LogMeta;
use ethers::prelude::Provider;
use ethers::providers::Middleware;
use ethers::types::Address;
use ethers::utils::to_checksum;
use num_bigint::BigInt;
use sea_orm::NotSet;
use sea_orm::Set;
use seaorm::{dao_handler, vote};
use serde::Deserialize;
use std::str::FromStr;
use std::sync::Arc;

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct Decoder {
    address_vote: String,
}

pub async fn maker_poll_votes(dao_handler: &dao_handler::Model) -> Result<ChainVotesResult> {
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

    let address = decoder
        .address_vote
        .parse::<Address>()
        .context("bad address")?;

    let gov_contract = maker_poll_vote::new(address, eth_rpc);

    let logs = gov_contract
        .voted_filter()
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("bad query")?;

    let votes = get_votes(logs.clone(), dao_handler)
        .await
        .context("bad votes")?;

    Ok(ChainVotesResult {
        votes,
        to_index: Some(to_block as i32),
    })
}

async fn get_votes(
    logs: Vec<(VotedFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VotedFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        let options = get_options(log.option_id.to_string()).await?;

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set(0.into()),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(options.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.poll_id.to_string()),
            dao_id: Set(dao_handler.dao_id.clone()),
            dao_handler_id: Set(dao_handler.id.clone()),
            ..Default::default()
        })
    }

    Ok(votes)
}

//I have no idea how this works but this is the reverse of what mkr does here
//https://github.com/makerdao/governance-portal-v2/blob/efeaa159a86748646af136f34c807b2dc9a2c401/modules/polling/api/victory_conditions/__tests__/instantRunoff.spec.ts#L13

async fn get_options(raw_option: String) -> Result<Vec<u8>> {
    pub enum Endian {
        Big,
    }

    pub struct ToBufferOptions {
        pub endian: Endian,
        pub size: usize,
    }

    impl Default for ToBufferOptions {
        fn default() -> Self {
            ToBufferOptions {
                endian: Endian::Big,
                size: 1,
            }
        }
    }

    let opts = ToBufferOptions::default();
    let num = BigInt::from_str(raw_option.as_str())
        .map_err(|_| "Invalid input")
        .unwrap();

    let mut hex = num.to_bytes_be().1;
    if hex.len() % opts.size != 0 {
        let padding = opts.size - (hex.len() % opts.size);
        let mut padded_hex = vec![0; padding];
        padded_hex.append(&mut hex);
        hex = padded_hex;
    }

    let mut buf = Vec::new();

    for chunk in hex.chunks(opts.size) {
        match opts.endian {
            Endian::Big => buf.extend_from_slice(chunk),
        }
    }

    Ok(buf)
}
