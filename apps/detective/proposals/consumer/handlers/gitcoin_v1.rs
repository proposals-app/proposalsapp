use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::gitcoin_v_1_gov::{gitcoin_v1_gov, ProposalCreatedFilter};
use ethers::prelude::*;
use scanners::etherscan::estimate_timestamp;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, instrument, warn};

pub struct GitcoinV1Handler;

#[async_trait]
impl ProposalHandler for GitcoinV1Handler {
    #[instrument(skip(self, dao_handler, _dao,), fields(dao_handler_id = %dao_handler.id, from_index))]
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
        from_index: i32,
    ) -> Result<ProposalsResult> {
        info!("Fetching proposals for GitcoinV1Handler");
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
            .as_u64();

        let from_block = from_index;
        let to_block =
            if from_index as u64 + dao_handler.proposals_refresh_speed as u64 > current_block {
                current_block
            } else {
                from_index as u64 + dao_handler.proposals_refresh_speed as u64
            };

        let address = "0xDbD27635A534A3d3169Ef0498beB56Fb9c937489"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = gitcoin_v1_gov::new(address, eth_rpc.clone());

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
            let p =
                data_for_proposal(p.clone(), &eth_rpc, dao_handler, gov_contract.clone()).await?;
            result.push(p);
        }

        Ok(ProposalsResult {
            proposals: result,
            to_index: Some(to_block as i32),
        })
    }

    fn min_refresh_speed(&self) -> i32 {
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (
        contracts::gen::gitcoin_v_1_gov::ProposalCreatedFilter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: gitcoin_v1_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (ProposalCreatedFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.getblock")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let voting_start_block_number = log.start_block.as_u64();
    let voting_end_block_number = log.end_block.as_u64();

    let average_block_time_millis = 12_200;

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        Err(_) => {
            #[allow(deprecated)]
            let fallback = NaiveDateTime::from_timestamp_millis(
                (created_block_timestamp.and_utc().timestamp() * 1000)
                    + (voting_start_block_number as i64 - created_block_number as i64)
                        * average_block_time_millis,
            )
            .context("bad timestamp")?;
            warn!(
                "Could not estimate timestamp for {:?}",
                voting_start_block_number
            );
            info!("Fallback to {:?}", fallback);
            fallback
        }
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        Err(_) => {
            #[allow(deprecated)]
            let fallback = NaiveDateTime::from_timestamp_millis(
                created_block_timestamp.and_utc().timestamp() * 1000
                    + (voting_end_block_number - created_block_number) as i64
                        * average_block_time_millis,
            )
            .context("bad timestamp")?;
            warn!(
                "Could not estimate timestamp for {:?}",
                voting_end_block_number
            );
            info!("Fallback to {:?}", fallback);
            fallback
        }
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

    let proposal_url = format!("https://www.tally.xyz/gov/gitcoin/proposal/{}", log.id);

    let proposal_external_id = log.id.to_string();

    let onchain_proposal = gov_contract
        .proposals(log.id)
        .call()
        .await
        .context("gov_contract.proposals")?;

    let choices = vec!["For", "Against"];

    let scores = vec![
        onchain_proposal.5.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.6.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();

    let scores_quorum = onchain_proposal.5.as_u128() as f64 / (10.0f64.powi(18));

    let quorum = gov_contract
        .quorum_votes()
        .call()
        .await
        .context("gov_contract.quorum_votes")?
        .as_u128() as f64
        / (10.0f64.powi(18));

    let proposal_state = gov_contract
        .state(log.id)
        .call()
        .await
        .context("gov_contract.state")?;

    let state = match proposal_state {
        0 => ProposalStateEnum::Pending,
        1 => ProposalStateEnum::Active,
        2 => ProposalStateEnum::Canceled,
        3 => ProposalStateEnum::Defeated,
        4 => ProposalStateEnum::Succeeded,
        5 => ProposalStateEnum::Queued,
        6 => ProposalStateEnum::Expired,
        7 => ProposalStateEnum::Executed,
        _ => ProposalStateEnum::Unknown,
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
        flagged: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(Some(created_block_timestamp)),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(created_block_number as i32),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
        metadata: NotSet,
    })
}
