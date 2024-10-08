use crate::{VotesHandler, VotesResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use contracts::gen::uniswap_gov::{uniswap_gov::uniswap_gov, VoteCastFilter};
use ethers::{
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::Address,
    utils::to_checksum,
};
use sea_orm::{NotSet, Set};
use seaorm::{dao, dao_handler, proposal, vote};
use std::sync::Arc;
use tracing::{info, instrument};

pub struct UniswapHandler;

#[async_trait]
impl VotesHandler for UniswapHandler {
    async fn get_proposal_votes(
        &self,
        _dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
        _proposal: &proposal::Model,
    ) -> Result<VotesResult> {
        Ok(VotesResult {
            votes: vec![],
            to_index: None,
        })
    }
    #[instrument(skip(self, dao_handler), fields(dao_handler_id = %dao_handler.id))]
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult> {
        info!("Fetching votes for UniswapHandler");
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

        let address = "0x408ED6354d4973f66138C91495F2f2FCbd8724C3"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = uniswap_gov::new(address, eth_rpc);

        let logs = gov_contract
            .vote_cast_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), dao_handler).context("bad votes")?;

        Ok(VotesResult {
            votes,
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
            voting_power: Set((log.votes.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(match log.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(dao_handler.dao_id),
            dao_handler_id: Set(dao_handler.id),
            ..Default::default()
        })
    }

    Ok(votes)
}
