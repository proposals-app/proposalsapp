use crate::{
    chain_data::{self},
    indexer::{Indexer, ProcessResult, VotesIndexer},
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::{BlockTransactionsKind, Log},
    sol,
};
use alloy_chains::NamedChain;
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::DateTime;
use nouns_proposals_gov::VoteCast;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, sea_orm_active_enums::IndexerVariant, vote};
use std::{sync::Arc, time::Duration};
use tracing::{info, instrument};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    nouns_proposals_gov,
    "./abis/nouns_proposals_gov.json"
);

pub struct NounsMainnetVotesIndexer;

impl NounsMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::NounsProposalsMainnetProposals
    }
}

#[async_trait]
impl Indexer for NounsMainnetVotesIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::NounsProposalsMainnetVotes
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait]
impl VotesIndexer for NounsMainnetVotesIndexer {
    #[instrument(skip_all)]
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Nouns Votes");

        let eth_rpc = chain_data::get_chain_config(NamedChain::Mainnet)?
            .provider
            .clone();

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("6f3E6272A167e8AcCb32072d08E0957F9c79223d");

        let gov_contract = nouns_proposals_gov::new(address, eth_rpc.clone());

        let logs = gov_contract
            .VoteCast_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let votes = get_votes(logs.clone(), indexer, &eth_rpc)
            .await
            .context("bad votes")?;

        Ok(ProcessResult::Votes(votes, to_block))
    }
}

#[instrument(skip_all)]
async fn get_votes(
    logs: Vec<(VoteCast, Log)>,
    indexer: &dao_indexer::Model,
    rpc: &Arc<ReqwestProvider>,
) -> Result<Vec<vote::ActiveModel>> {
    let voter_logs: Vec<(VoteCast, Log)> = logs.into_iter().collect();

    let mut votes: Vec<vote::ActiveModel> = vec![];

    for (event, log) in voter_logs {
        let created_block_number = log.block_number.unwrap();
        let created_block_timestamp = rpc
            .get_block_by_number(
                log.block_number.unwrap().into(),
                BlockTransactionsKind::Hashes,
            )
            .await
            .context("get_block_by_number")?
            .unwrap()
            .header
            .timestamp;

        let created_block_timestamp =
            DateTime::from_timestamp_millis(created_block_timestamp as i64 * 1000)
                .unwrap()
                .naive_utc();

        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(created_block_number as i32),
            voter_address: Set(event.voter.to_string()),
            choice: Set(match event.support {
                0 => 1.into(),
                1 => 0.into(),
                2 => 2.into(),
                _ => 2.into(),
            }),
            voting_power: Set(event.votes.to::<u128>() as f64),
            reason: Set(Some(event.reason)),
            block_created: Set(Some(created_block_number as i32)),
            created_at: Set(created_block_timestamp),
            proposal_id: NotSet,
            proposal_external_id: Set(event.proposalId.to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(votes)
}

#[cfg(test)]
mod nouns_mainnet_votes_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use serde_json::json;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[tokio::test]
    async fn nouns_mainnet_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbCoreArbitrumProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 20962386,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
            name: Some("Indexer".into()),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        match NounsMainnetVotesIndexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 20962386,
                    voter_address: "0xaE65E700f3f8904ac1007d47a5309dD26f8146c0",
                    choice: json!(0),
                    voting_power: 22.0,
                    reason: Some("\n\n\n\n+1\n\n> I generally agree with peters view here but also feel ok backing tagawa regardless. If this doesnt pass, i would consider taking peters advice to heart more directly in order to find a path forward where the dao can continue to fund your wonderful output. Thank you!\n> \n> +1\n> \n> > i don't understand why this prop and others before it include trips to the United States. I'd prefer you define success and pursue it within your local communities at a decreased cost.\n> > \n> > reduce workshop logistic costs, remove farcaster interactive digital gallery, reduce marketing & distribution, reduce travel & accomodation."),
                    proposal_external_id: "656",
                    time_created: Some(parse_datetime("2024-10-14 07:41:23")),
                    block_created: Some(20962386),
                    txid: Some(
                        "0x55f82fd9a6066f2e9fd67200a42f5e7f2dd814dd489d1e0b72829192e5c41e51",
                    ),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
