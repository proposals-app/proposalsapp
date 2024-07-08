use crate::{VotesHandler, VotesResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use contracts::gen::arbitrum_treasury_gov::arbitrum_treasury_gov::arbitrum_treasury_gov;
use contracts::gen::arbitrum_treasury_gov::{VoteCastFilter, VoteCastWithParamsFilter};
use ethers::prelude::Http;
use ethers::prelude::LogMeta;
use ethers::prelude::Provider;
use ethers::providers::Middleware;
use ethers::types::Address;
use ethers::utils::to_checksum;
use sea_orm::NotSet;
use sea_orm::Set;
use seaorm::{dao_handler, proposal, vote};
use serde::Deserialize;
use std::sync::Arc;

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
}

pub struct ArbitrumTreasuryHandler;

#[async_trait]
impl VotesHandler for ArbitrumTreasuryHandler {
    async fn get_proposal_votes(
        &self,
        dao_handler: &dao_handler::Model,
        proposal: &proposal::Model,
    ) -> Result<VotesResult> {
        Ok(VotesResult {
            votes: vec![],
            to_index: None,
        })
    }
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult> {
        let arb_rpc_url = std::env::var("ARBITRUM_NODE_URL").expect("Arbitrum node not set!");
        let arb_rpc = Arc::new(Provider::<Http>::try_from(arb_rpc_url).unwrap());

        let current_block = arb_rpc
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

        let gov_contract = arbitrum_treasury_gov::new(address, arb_rpc);

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

        Ok(VotesResult {
            votes: all_votes,
            to_index: Some(to_block as i32),
        })
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

fn get_votes(
    logs: Vec<(VoteCastFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id.clone()),
            dao_handler_id: Set(dao_handler.id.clone()),
            ..Default::default()
        })
    }

    Ok(votes)
}

fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    dao_handler: &dao_handler::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParamsFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id.clone()),
            dao_handler_id: Set(dao_handler.id.clone()),
            ..Default::default()
        })
    }

    Ok(votes)
}
