use crate::{database::DatabaseStore, indexer::Indexer};
use anyhow::{Context, Result};
use contracts::gen::optimism_gov_v_6::{optimism_gov_v6, VoteCastFilter, VoteCastWithParamsFilter};
use ethers::{
    abi::{decode, ParamType},
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::Address,
    utils::to_checksum,
};
use rust_decimal::prelude::*;
use sea_orm::ColumnTrait;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, Condition, DatabaseConnection, EntityTrait, QueryFilter,
    Set,
};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use tracing::info;
use utils::errors::{DATABASE_ERROR, PROPOSAL_NOT_FOUND_ERROR};

pub struct OptimismVotesIndexer;

impl OptimismVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::OpOptimismProposals
    }
}

#[async_trait::async_trait]
impl Indexer for OptimismVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Optimism Votes");
        let op_rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
        let op_rpc = Arc::new(Provider::<Http>::try_from(op_rpc_url).unwrap());

        let current_block = op_rpc
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

        let address = "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = optimism_gov_v6::new(address, op_rpc.clone());

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

        let votes = get_votes(logs.clone(), indexer).context("bad votes")?;

        let db = DatabaseStore::connect().await?;

        let votes_with_params = get_votes_with_params(logs_with_params.clone(), indexer, &db)
            .await
            .context("bad votes")?;

        let all_votes = [votes, votes_with_params].concat();

        Ok((Vec::new(), all_votes, to_block))
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
}

fn get_votes(
    logs: Vec<(VoteCastFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
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
            choice: Set(log.support.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(log.reason)),
            time_created: NotSet,
            txid: Set(Some(format!("{:#x}", meta.transaction_hash))),
        })
    }

    Ok(votes)
}

async fn get_votes_with_params(
    logs: Vec<(VoteCastWithParamsFilter, LogMeta)>,
    indexer: &dao_indexer::Model,
    db: &DatabaseConnection,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCastWithParamsFilter, LogMeta)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (log, meta) in voter_logs {
        let mut choice = vec![log.support.into()];

        let proposal_handler_id: Vec<Uuid> = dao_indexer::Entity::find()
            .filter(
                dao_indexer::Column::IndexerVariant.is_in([IndexerVariant::OpOptimismProposals]),
            )
            .all(db)
            .await
            .context(DATABASE_ERROR)?
            .into_iter()
            .map(|dh| dh.id)
            .collect();

        let mut proposal = proposal::Entity::find()
            .filter(
                Condition::all()
                    .add(proposal::Column::ExternalId.eq(log.proposal_id.to_string()))
                    .add(proposal::Column::DaoIndexerId.is_in(proposal_handler_id)),
            )
            .one(db)
            .await
            .context(DATABASE_ERROR)?
            .context(PROPOSAL_NOT_FOUND_ERROR)?;

        #[derive(Deserialize)]
        struct ProposalMetadata {
            voting_module: Value,
        }

        let proposal_metadata: ProposalMetadata =
            serde_json::from_value(proposal.metadata.expect("bad proposal metadata"))?;

        //TODO: this only considers for votes
        //      against and abstain should be handled somehow as well
        //      this happens in vote without params

        if log.params.len() > 0 {
            if proposal_metadata.voting_module == "0xdd0229D72a414DC821DEc66f3Cc4eF6dB2C7b7df" {
                let param_types = vec![ParamType::Array(Box::new(ParamType::Uint(256)))];

                let decoded =
                    decode(&param_types, &log.params).context("Failed to decode params")?;

                if let Some(ethers::abi::Token::Array(options)) = decoded.first() {
                    let mut current_scores: Vec<Decimal> =
                        serde_json::from_value(proposal.scores.clone())?;
                    let voting_power = Decimal::from_str(&log.weight.to_string())?
                        .checked_div(Decimal::from(10u64.pow(18)))
                        .unwrap_or(Decimal::ZERO);

                    choice = vec![];
                    for option in options.iter() {
                        if let ethers::abi::Token::Uint(value) = option {
                            let choice_index = value.as_u64() as usize;

                            if choice_index < current_scores.len() {
                                current_scores[choice_index] += voting_power;
                            }
                            choice.push(choice_index as i32);
                        }
                    }

                    let f64_scores: Vec<f64> = current_scores
                        .iter()
                        .map(|d| d.to_f64().unwrap_or(0.0))
                        .collect();

                    proposal.scores = serde_json::to_value(f64_scores)?;

                    proposal::Entity::update(proposal::ActiveModel {
                        id: Set(proposal.id),
                        scores: Set(proposal.scores),
                        ..Default::default()
                    })
                    .exec(db)
                    .await
                    .context(DATABASE_ERROR)?;
                }
            }

            if proposal_metadata.voting_module == "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5" {
                let param_types = vec![ParamType::Array(Box::new(ParamType::Uint(256)))];

                let decoded =
                    decode(&param_types, &log.params).context("Failed to decode params")?;

                choice = vec![];
                if let Some(ethers::abi::Token::Array(options)) = decoded.first() {
                    for option in options {
                        if let ethers::abi::Token::Uint(value) = option {
                            choice.push(value.as_u64() as i32);
                        }
                    }
                }
            }
        }

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(meta.block_number.as_u64() as i32),
            voter_address: Set(to_checksum(&log.voter, None)),
            voting_power: Set((log.weight.as_u128() as f64) / (10.0f64.powi(18))),
            block_created: Set(Some(meta.block_number.as_u64() as i32)),
            choice: Set(choice.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(log.proposal_id.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            reason: Set(Some(log.reason)),
            time_created: NotSet,
            txid: Set(Some(format!("{:#x}", meta.transaction_hash))),
        })
    }

    Ok(votes)
}
