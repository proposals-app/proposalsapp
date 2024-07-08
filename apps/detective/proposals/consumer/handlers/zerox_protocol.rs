use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::{NaiveDateTime, Utc};
use contracts::gen::zerox_staking::zerox_staking::zerox_staking;
use contracts::gen::zerox_treasury::zerox_treasury::zerox_treasury;
use contracts::gen::zerox_treasury::ProposalCreatedFilter;
use ethers::prelude::*;
use sea_orm::ActiveValue::NotSet;
use sea_orm::Set;
use seaorm::sea_orm_active_enums::ProposalStateEnum;
use seaorm::{dao_handler, proposal};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
    stakingProxy: String,
    proposalUrl: String,
}

pub struct ZeroxProtocolHandler;

#[async_trait]
impl ProposalHandler for ZeroxProtocolHandler {
    async fn get_proposals(&self, dao_handler: &dao_handler::Model) -> Result<ProposalsResult> {
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
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

        let decoder: Decoder = serde_json::from_value(dao_handler.decoder.clone())?;

        let address = decoder.address.parse::<Address>().context("bad address")?;

        let gov_contract = zerox_treasury::new(address, eth_rpc.clone());

        let staking_proxy_address = decoder
            .stakingProxy
            .parse::<Address>()
            .context("bad address")?;

        let staking_proxy_contract = zerox_staking::new(staking_proxy_address, eth_rpc.clone());

        let proposal_events = gov_contract
            .proposal_created_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut result = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(
                p.clone(),
                &eth_rpc,
                &decoder,
                dao_handler,
                gov_contract.clone(),
                staking_proxy_contract.clone(),
            )
            .await?;
            result.push(p);
        }

        Ok(ProposalsResult {
            proposals: result,
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

async fn data_for_proposal(
    p: (
        contracts::gen::zerox_treasury::ProposalCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    decoder: &Decoder,
    dao_handler: &dao_handler::Model,
    gov_contract: zerox_treasury<ethers::providers::Provider<ethers::providers::Http>>,
    staking_proxy_contract: zerox_staking<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block
        .context("bad block")?
        .time()?
        .naive_utc()
        .and_utc()
        .timestamp();

    #[allow(deprecated)]
    let created_block_time = NaiveDateTime::from_timestamp_millis(created_block_timestamp * 1000)
        .context("bad timestamp")?;

    let onchain_proposal = gov_contract
        .proposals(log.proposal_id)
        .call()
        .await
        .context("gov_contract.proposals")?;

    let epoch_duration = staking_proxy_contract
        .epoch_duration_in_seconds()
        .await?
        .as_u64();
    let epochs_start = staking_proxy_contract
        .current_epoch_start_time_in_seconds()
        .await?
        .as_u64()
        - staking_proxy_contract.current_epoch().await?.as_u64() * epoch_duration;

    let voting_starts_timestamp = epochs_start + onchain_proposal.2.as_u64() * epoch_duration;

    #[allow(deprecated)]
    let voting_starts_time =
        NaiveDateTime::from_timestamp_millis((voting_starts_timestamp * 1000).try_into().unwrap())
            .context("bad timestamp")?;

    let voting_ends_timestamp = epochs_start + (onchain_proposal.2.as_u64() + 1) * epoch_duration;

    #[allow(deprecated)]
    let voting_ends_time =
        NaiveDateTime::from_timestamp_millis((voting_ends_timestamp * 1000).try_into().unwrap())
            .context("bad timestamp")?;

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

    let proposal_url = format!("{}{}", decoder.proposalUrl, log.proposal_id);

    let proposal_external_id = log.proposal_id.to_string();

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.3.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.4.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let quorum = gov_contract
        .proposal_threshold()
        .call()
        .await
        .context("gov_contract.proposal_threshold")?
        .as_u128() as f64
        / (10.0f64.powi(18));

    let proposal_state = onchain_proposal.5;

    let state = if voting_starts_time > Utc::now().naive_utc() {
        ProposalStateEnum::Pending
    } else if voting_ends_time > Utc::now().naive_utc() {
        match proposal_state {
            false => ProposalStateEnum::Active,
            true => ProposalStateEnum::Executed,
        }
    } else {
        match proposal_state {
            false => ProposalStateEnum::Defeated,
            true => ProposalStateEnum::Executed,
        }
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
        quorum: Set(quorum),
        proposal_state: Set(state),
        flagged: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(Some(created_block_time)),
        time_start: Set(voting_starts_time),
        time_end: Set(voting_ends_time),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(created_block_number as i32),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
    })
}
