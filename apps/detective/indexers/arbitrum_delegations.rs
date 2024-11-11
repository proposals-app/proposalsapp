use crate::{
    indexer::{DelegationIndexer, Indexer, ProcessResult},
    rpc_providers,
};
use alloy::{
    primitives::address,
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
};
use anyhow::{Context, Result};
use arb_token::DelegateChanged;
use async_trait::async_trait;
use chrono::DateTime;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, delegation};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    arb_token,
    "./abis/arb_token.json"
);

pub struct ArbitrumDelegationsIndexer;

#[async_trait]
impl Indexer for ArbitrumDelegationsIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
}

#[async_trait]
impl DelegationIndexer for ArbitrumDelegationsIndexer {
    async fn process_delegations(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Arbitrum Core Votes");

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
            .DelegateChanged_filter()
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("query")?;

        let delegations = get_delegations(logs.clone(), &arb_rpc.clone(), &indexer.clone())
            .await
            .context("bad votes")?;

        Ok(ProcessResult::Delegation(delegations, to_block))
    }
}

async fn get_delegations(
    logs: Vec<(DelegateChanged, Log)>,
    rpc: &Arc<ReqwestProvider>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<delegation::ActiveModel>> {
    let delegation_logs: Vec<(DelegateChanged, Log)> = logs.into_iter().collect();

    let mut delegations: Vec<delegation::ActiveModel> = vec![];

    for (event, log) in delegation_logs {
        let created_block_number = log.block_number.unwrap();
        let created_block_timestamp = rpc
            .get_block_by_number(log.block_number.unwrap().into(), false)
            .await
            .context("get_block_by_number")?
            .unwrap()
            .header
            .timestamp;

        let created_block_timestamp =
            DateTime::from_timestamp_millis(created_block_timestamp as i64 * 1000)
                .unwrap()
                .naive_utc();

        delegations.push(delegation::ActiveModel {
            id: NotSet,
            delegator: Set(event.delegator.to_string()),
            delegate: Set(event.toDelegate.to_string()),
            dao_id: Set(indexer.dao_id),
            block: Set(created_block_number as i32),
            timestamp: Set(created_block_timestamp),
            txid: Set(Some(format!(
                "0x{}",
                hex::encode(log.transaction_hash.unwrap())
            ))),
        })
    }

    Ok(delegations)
}

#[cfg(test)]
mod arbitrum_delegations {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::sea_orm_active_enums::IndexerVariant;
    use utils::test_utils::{assert_delegation, parse_datetime, ExpectedDelegation};

    #[tokio::test]
    async fn arbitrum_delegations_1() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::ArbArbitrumDelegation,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Delegation,
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

        match ArbitrumDelegationsIndexer
            .process_delegations(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Delegation(delegations, _)) => {
                assert!(!delegations.is_empty(), "No delegations were fetched");

                let expected = ExpectedDelegation {
                    delegator: "0xa93Ae3a2cE1714F422eC2d799c48A56b2035C872",
                    delegate: "0xE594469fDe6AE29943a64f81d95c20F5F8eB2e04",
                    block: 258594511,
                    timestamp: parse_datetime("2024-09-29 13:40:08"),
                    txid: Some(
                        "0x698c71a6655879e7f57799d828fd0bb4b339d827109a2de1f2688b4be76d60b5",
                    ),
                };

                assert_delegation(&delegations[0], &expected);
            }
            _ => panic!("Failed to index delegations"),
        }
    }
}
