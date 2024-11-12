use crate::{
    indexer::{Indexer, ProcessResult, VotingPowerIndexer},
    rpc_providers,
};
use alloy::rpc::types::BlockTransactionsKind;
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
};
use anyhow::{Context, Result};
use arb_token::DelegateVotesChanged;
use async_trait::async_trait;
use chrono::DateTime;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::sea_orm_active_enums::IndexerType;
use seaorm::{dao, dao_indexer, voting_power};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arb_token,
    "./abis/arb_token.json"
);

pub struct ArbitrumVotingPowerIndexer;

#[async_trait]
impl Indexer for ArbitrumVotingPowerIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::VotingPower
    }
}

#[async_trait]
impl VotingPowerIndexer for ArbitrumVotingPowerIndexer {
    async fn process_voting_powers(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Voting Power");

        let arb_rpc = rpc_providers::get_provider("arbitrum")?;

        let current_block = arb_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed > current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("912CE59144191C1204E64559FE8253a0e49E6548");

        let token_contract = arb_token::new(address, arb_rpc.clone());

        let logs = token_contract
            .DelegateVotesChanged_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let voting_powers = get_voting_power(logs.clone(), &arb_rpc.clone(), &indexer.clone())
            .await
            .context("bad votes")?;

        Ok(ProcessResult::VotingPower(voting_powers, to_block))
    }
}

async fn get_voting_power(
    logs: Vec<(DelegateVotesChanged, Log)>,
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<voting_power::ActiveModel>> {
    let voting_power_logs: Vec<(DelegateVotesChanged, Log)> = logs.into_iter().collect();

    let mut voting_powers: Vec<voting_power::ActiveModel> = vec![];

    for (event, log) in voting_power_logs {
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

        voting_powers.push(voting_power::ActiveModel {
            id: NotSet,
            voter: Set(event.delegate.to_string()),
            voting_power: Set((event.newBalance.to::<u128>() as f64) / (10.0f64.powi(18))),
            dao_id: Set(indexer.dao_id),
            block: Set(created_block_number as i32),
            timestamp: Set(created_block_timestamp),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(voting_powers)
}

#[cfg(test)]
mod arbitrum_voting_power_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use utils::test_utils::{assert_voting_power, parse_datetime, ExpectedVotingPower};

    #[tokio::test]
    async fn arbitrum_voting_power_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbArbitrumVotingPower,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::VotingPower,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 258594511,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
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

        match ArbitrumVotingPowerIndexer
            .process_voting_powers(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::VotingPower(voting_powers, _)) => {
                assert!(!voting_powers.is_empty(), "No voting powers were fetched");

                let expected = ExpectedVotingPower {
                    voter: "0xE594469fDe6AE29943a64f81d95c20F5F8eB2e04",
                    voting_power: 52335.847297893175,
                    block: 258594511,
                    timestamp: parse_datetime("2024-09-29 13:40:08"),
                    txid: Some(
                        "0x698c71a6655879e7f57799d828fd0bb4b339d827109a2de1f2688b4be76d60b5",
                    ),
                };

                assert_voting_power(&voting_powers[1], &expected);
            }
            _ => panic!("Failed to index voting powers"),
        }
    }
}
