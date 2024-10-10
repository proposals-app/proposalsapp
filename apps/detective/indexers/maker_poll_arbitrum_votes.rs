use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::maker_poll_vote_arbitrum::{
    maker_poll_vote_arbitrum::maker_poll_vote_arbitrum, VotedFilter,
};
use ethers::{
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::Address,
    utils::to_checksum,
};
use num_bigint::BigInt;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use std::{str::FromStr, sync::Arc};
use tracing::info;

pub struct MakerPollArbitrumVotesIndexer;

impl MakerPollArbitrumVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::MakerPollMainnetProposals
    }
}

#[async_trait::async_trait]
impl Indexer for MakerPollArbitrumVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Maker Poll Arbitrum Votes");
        let arb_rpc_url = std::env::var("ARBITRUM_NODE_URL").expect("Arbitrum node not set!");
        let arb_rpc = Arc::new(Provider::<Http>::try_from(arb_rpc_url).unwrap());

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("bad current block")?
            .as_u32() as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = "0x4f4e551b4920a5417F8d4e7f8f099660dAdadcEC"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = maker_poll_vote_arbitrum::new(address, arb_rpc.clone());

        let logs = gov_contract
            .voted_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let votes = get_votes(logs.clone(), indexer)
            .await
            .context("bad votes")?;

        Ok((Vec::new(), votes, to_block))
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
}

async fn get_votes(
    logs: Vec<(VotedFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
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
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            time_created: NotSet,
            reason: NotSet,
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(meta.transaction_hash.as_bytes())
            ))),
        })
    }

    Ok(votes)
}

async fn get_options(raw_option: String) -> Result<Vec<u8>> {
    enum Endian {
        Big,
    }

    struct ToBufferOptions {
        endian: Endian,
        size: usize,
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
    let num = BigInt::from_str(&raw_option).context("Invalid input")?;

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
