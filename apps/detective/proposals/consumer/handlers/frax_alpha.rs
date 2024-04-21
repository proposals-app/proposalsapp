use crate::ChainProposalsResult;
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use contracts::gen::frax_alpha_gov::frax_alpha_gov::frax_alpha_gov;
use contracts::gen::frax_alpha_gov::ProposalCreatedFilter;
use ethers::prelude::*;
use sea_orm::ActiveValue::NotSet;
use sea_orm::Set;
use seaorm::sea_orm_active_enums::ProposalState;
use seaorm::{dao_handler, proposal};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
    proposalUrl: String,
}

pub async fn frax_alpha_proposals(
    dao_handler: &dao_handler::Model,
) -> Result<ChainProposalsResult> {
    let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
    let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

    let current_block = eth_rpc
        .get_block_number()
        .await
        .context("get_block_number")?
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

    let gov_contract = frax_alpha_gov::new(address, eth_rpc.clone());

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
        )
        .await
        .context("data_for_proposal")?;
        result.push(p);
    }

    Ok(ChainProposalsResult {
        proposals: result,
        to_index: Some(to_block as i64),
    })
}

async fn data_for_proposal(
    p: (
        contracts::gen::frax_alpha_gov::ProposalCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    decoder: &Decoder,
    dao_handler: &dao_handler::Model,
    gov_contract: frax_alpha_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    #[allow(deprecated)]
    let voting_starts_timestamp =
        NaiveDateTime::from_timestamp_millis((log.vote_start.as_u64() * 1000).try_into().unwrap())
            .unwrap();

    #[allow(deprecated)]
    let voting_ends_timestamp =
        NaiveDateTime::from_timestamp_millis((log.vote_end.as_u64() * 1000).try_into().unwrap())
            .unwrap();

    let proposal_url = format!("{}{}", decoder.proposalUrl, log.proposal_id);

    let proposal_external_id = log.proposal_id.to_string();

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

    if title.starts_with("# ") {
        title = title.split_off(2);
    }

    if title.is_empty() {
        title = "Unknown".into()
    }

    let choices = vec!["For", "Against", "Abstain"];

    let (against_votes, for_votes, abstain_votes) = gov_contract
        .proposal_votes(log.proposal_id)
        .await
        .context("gov_contract.proposal_votes")?;

    let scores_total: f64 =
        (against_votes + for_votes + abstain_votes).as_u128() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorum(log.vote_start)
        .await
        .context("gov_contract.quorum")?
        .as_u128() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .call()
        .await
        .context("gov_contract.state")
        .unwrap_or(99); //default to Unknown

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
        scores: Set(json!(vec![
            for_votes.as_u128() as f64 / (10.0f64.powi(18)),
            against_votes.as_u128() as f64 / (10.0f64.powi(18)),
            abstain_votes.as_u128() as f64 / (10.0f64.powi(18))
        ])),
        scores_total: Set(scores_total),
        quorum: Set(quorum),
        proposal_state: Set(state),
        flagged: NotSet,
        block_created: Set(Some(created_block_number as i64)),
        time_created: Set(Some(created_block_timestamp)),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(created_block_number as i64),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
    })
}
