use crate::indexer::Indexer;
use anyhow::{Context, Result};
use chrono::DateTime;
use contracts::gen::lido_aragon_voting::{lido_aragon_voting::lido_aragon_voting, StartVoteFilter};
use ethers::{
    abi::Address,
    contract::LogMeta,
    providers::{Http, Middleware, Provider},
};
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde_json::json;
use std::sync::Arc;
use tracing::info;

pub struct LidoMainnetProposalsIndexer;

#[async_trait::async_trait]
impl Indexer for LidoMainnetProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Lido Proposals");

        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
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

        let address = "0x2e59a20f205bb85a89c53f1936454680651e618e"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = lido_aragon_voting::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .start_vote_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut proposals = Vec::new();

        for p in proposal_events.iter() {
            let p = data_for_proposal(p.clone(), &eth_rpc, indexer, gov_contract.clone())
                .await
                .context("data_for_proposal")?;
            proposals.push(p);
        }

        Ok((proposals, Vec::new(), to_block))
    }
    fn min_refresh_speed(&self) -> i32 {
        10
    }
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
}

async fn data_for_proposal(
    p: (StartVoteFilter, LogMeta),
    rpc: &Arc<Provider<Http>>,
    indexer: &dao_indexer::Model,
    gov_contract: lido_aragon_voting<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (StartVoteFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();

    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.getblock")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let proposal_external_id = log.vote_id.to_string();
    let title = format!("Vote #{}", log.vote_id);
    let body = log.metadata.to_string();
    let proposal_url = format!("https://vote.lido.fi/vote/{}", log.vote_id);
    let discussionurl = String::from("");

    let onchain_proposal = gov_contract
        .get_vote(log.vote_id)
        .call()
        .await
        .context("gov_contract.get_vote")?;

    let choices = vec!["yea", "nay"];
    let scores = vec![
        onchain_proposal.6.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.7.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();
    let quorum = onchain_proposal.5 as f64 / (10.0f64.powi(18));

    let scores_quorum = scores.iter().sum();

    let state = if onchain_proposal.0 {
        ProposalState::Active
    } else if onchain_proposal.1 {
        ProposalState::Executed
    } else {
        ProposalState::Defeated
    };

    let voting_starts_timestamp = DateTime::from_timestamp_millis(onchain_proposal.2 as i64)
        .context("Invalid timestamp")?
        .naive_utc();

    let voting_time = gov_contract
        .vote_time()
        .call()
        .await
        .context("gov_contract.vote_time")?;

    let voting_ends_timestamp =
        DateTime::from_timestamp_millis(onchain_proposal.2 as i64 + voting_time as i64)
            .context("Invalid timestamp")?
            .naive_utc();

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
        metadata: NotSet,
        txid: Set(Some(format!(
            "0x{}",
            hex::encode(meta.transaction_hash.as_bytes())
        ))),
    })
}
