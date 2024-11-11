use crate::{
    indexer::{Indexer, ProcessResult, VotesIndexer},
    rpc_providers,
};
use alloy::{
    primitives::{address, b256, Address, U256},
    providers::{Provider, ReqwestProvider},
    rpc::types::Log,
    sol,
    transports::http::Http,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use itertools::Itertools;
use maker_executive_gov::LogNote;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::sea_orm_active_enums::IndexerType;
use seaorm::{dao, dao_indexer, sea_orm_active_enums::IndexerVariant, vote};
use std::sync::Arc;
use tracing::info;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    maker_executive_gov,
    "./abis/maker_executive_gov.json"
);

pub struct MakerExecutiveMainnetVotesIndexer;

impl MakerExecutiveMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::MakerExecutiveMainnetProposals
    }
}

#[async_trait]
impl Indexer for MakerExecutiveMainnetVotesIndexer {
    fn min_refresh_speed(&self) -> i32 {
        1
    }

    fn max_refresh_speed(&self) -> i32 {
        100_000
    }
    fn indexer_type(&self) -> IndexerType {
        IndexerType::Votes
    }
}

#[async_trait]
impl VotesIndexer for MakerExecutiveMainnetVotesIndexer {
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Maker Executive Votes");

        let eth_rpc = rpc_providers::get_provider("ethereum")?;

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

        let address = address!("0a3f6849f78076aefaDf113F5BED87720274dDC0");

        let gov_contract = maker_executive_gov::new(address, eth_rpc);

        let vote_single_action_topic =
            b256!("a69beaba00000000000000000000000000000000000000000000000000000000");
        let vote_multiple_actions_topic =
            b256!("ed08132900000000000000000000000000000000000000000000000000000000");

        let single_spell_events = gov_contract
            .LogNote_filter()
            .event_signature(vote_single_action_topic)
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("bad query")?;

        let multi_spell_events = gov_contract
            .LogNote_filter()
            .event_signature(vote_multiple_actions_topic)
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("bad query")?;

        let single_spell_casts =
            get_single_spell_addresses(single_spell_events, gov_contract.clone())
                .await
                .context("bad spells")?;
        let multi_spell_casts = get_multi_spell_addresses(multi_spell_events)
            .await
            .context("bad spell")?;

        let spell_casts: Vec<SpellCast> = [single_spell_casts, multi_spell_casts]
            .concat()
            .into_iter()
            .filter(|sc| {
                !([
                    "0x0000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000002",
                    "0x0000000000000000000000000000000000000020",
                ]
                .contains(&sc.spell.as_str()))
            })
            .unique()
            .collect();

        let votes = get_votes(spell_casts.clone(), indexer)
            .await
            .context("bad votes")?;

        Ok(ProcessResult::Votes(votes, to_block))
    }
}

async fn get_votes(
    spell_casts: Vec<SpellCast>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<vote::ActiveModel>> {
    let mut votes: Vec<vote::ActiveModel> = vec![];

    for spell_cast in spell_casts {
        votes.push(vote::ActiveModel {
            id: NotSet,
            index_created: Set(0),
            voter_address: Set(spell_cast.voter.clone()),
            voting_power: Set(0.into()),
            block_created: Set(Some(0)),
            choice: Set(1.into()),
            proposal_id: NotSet,
            proposal_external_id: Set(spell_cast.spell[..42].to_string()),
            dao_id: Set(indexer.dao_id),
            indexer_id: Set(indexer.id),
            ..Default::default()
        })
    }

    Ok(votes)
}

//this takes out the first 4 bytes because that's the method being called
//after that, it builds a vec of 32 byte chunks for as long as the input is
fn extract_desired_bytes(bytes: &[u8]) -> Vec<[u8; 32]> {
    let mut iterration = 0;

    let mut result_vec = vec![];

    loop {
        let start_index = 4 + iterration * 32;

        if bytes.len() < start_index + 32 {
            break;
        }
        let mut result: [u8; 32] = [0; 32];

        for (i, byte) in bytes[start_index..(start_index + 32)].iter().enumerate() {
            result[i] = *byte;
        }
        result_vec.push(result);
        iterration += 1;
    }

    result_vec
}

#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct SpellCast {
    voter: String,
    spell: String,
}

pub async fn get_single_spell_addresses(
    logs: Vec<(LogNote, Log)>,
    gov_contract: maker_executive_gov::maker_executive_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<Vec<SpellCast>> {
    let mut spells: Vec<SpellCast> = vec![];

    for log in logs.clone() {
        let slate: [u8; 32] = *extract_desired_bytes(&log.0.fax).first().unwrap();

        let mut count: U256 = U256::from(0);

        loop {
            let address = gov_contract.slates(slate.into(), count).call().await;
            match address {
                Ok(addr) => {
                    spells.push(SpellCast {
                        voter: format!("0x{}", hex::encode(log.0.guy)),
                        spell: addr._0.to_checksum(None),
                    });
                    count += U256::from(1);
                }
                Err(_) => {
                    break;
                }
            }
        }
    }

    Ok(spells)
}

pub async fn get_multi_spell_addresses(logs: Vec<(LogNote, Log)>) -> Result<Vec<SpellCast>> {
    let mut spells: Vec<SpellCast> = vec![];

    for log in logs.clone() {
        let slates = extract_desired_bytes(&log.0.fax);

        for slate in slates {
            let slate_address = Address::from_slice(&slate[12..]);
            spells.push(SpellCast {
                voter: format!("0x{}", hex::encode(log.0.guy)),
                spell: slate_address.to_checksum(None),
            });
        }
    }

    Ok(spells)
}
