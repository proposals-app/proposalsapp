use crate::indexer::Indexer;
use anyhow::{Context, Result};
use contracts::gen::maker_executive_gov::{
    maker_executive_gov::maker_executive_gov, LogNoteFilter,
};
use ethers::{
    prelude::{Http, LogMeta, Provider},
    providers::Middleware,
    types::{Address, H256, U256},
    utils::to_checksum,
};
use itertools::Itertools;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use std::sync::Arc;
use tracing::info;

const VOTE_MULTIPLE_ACTIONS_TOPIC: &str =
    "0xed08132900000000000000000000000000000000000000000000000000000000";
const VOTE_SINGLE_ACTION_TOPIC: &str =
    "0xa69beaba00000000000000000000000000000000000000000000000000000000";

pub struct MakerExecutiveMainnetVotesIndexer;

impl MakerExecutiveMainnetVotesIndexer {
    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::MakerExecutiveMainnetProposals
    }
}

#[async_trait::async_trait]
impl Indexer for MakerExecutiveMainnetVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Maker Executive Votes");
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
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

        let address = "0x0a3f6849f78076aefaDf113F5BED87720274dDC0"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = maker_executive_gov::new(address, eth_rpc);

        let single_spell_events = gov_contract
            .log_note_filter()
            .topic0(vec![VOTE_SINGLE_ACTION_TOPIC.parse::<H256>()?])
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("bad query")?;

        let multi_spell_events = gov_contract
            .log_note_filter()
            .topic0(vec![VOTE_MULTIPLE_ACTIONS_TOPIC.parse::<H256>()?])
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
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

        Ok((Vec::new(), votes, to_block))
    }

    fn min_refresh_speed(&self) -> i32 {
        100
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000_000
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
            proposal_external_id: Set(spell_cast.spell.to_string()),
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
    logs: Vec<(LogNoteFilter, LogMeta)>,
    gov_contract: maker_executive_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<Vec<SpellCast>> {
    let mut spells: Vec<SpellCast> = vec![];

    for log in logs.clone() {
        let slate: [u8; 32] = *extract_desired_bytes(&log.0.fax).first().unwrap();

        let mut count: U256 = U256::from(0);

        loop {
            let address = gov_contract.slates(slate, count).await;
            match address {
                Ok(addr) => {
                    spells.push(SpellCast {
                        voter: to_checksum(&log.0.guy, None),
                        spell: to_checksum(&addr, None),
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

pub async fn get_multi_spell_addresses(
    logs: Vec<(LogNoteFilter, LogMeta)>,
) -> Result<Vec<SpellCast>> {
    let mut spells: Vec<SpellCast> = vec![];

    for log in logs.clone() {
        let slates = extract_desired_bytes(&log.0.fax);

        for slate in slates {
            let spell_address = Address::from(H256::from(slate));
            spells.push(SpellCast {
                voter: to_checksum(&log.0.guy, None),
                spell: to_checksum(&spell_address, None),
            });
        }
    }

    Ok(spells)
}
