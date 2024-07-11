use crate::{VotesHandler, VotesResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
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
use sea_orm::{NotSet, Set};
use seaorm::{dao_handler, proposal, vote};
use serde::Deserialize;
use std::sync::Arc;

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct Decoder {
    address: String,
}

const VOTE_MULTIPLE_ACTIONS_TOPIC: &str =
    "0xed08132900000000000000000000000000000000000000000000000000000000";
const VOTE_SINGLE_ACTION_TOPIC: &str =
    "0xa69beaba00000000000000000000000000000000000000000000000000000000";

pub struct MakerExecutiveHandler;

#[async_trait]
impl VotesHandler for MakerExecutiveHandler {
    async fn get_proposal_votes(
        &self,
        _dao_handler: &dao_handler::Model,
        _proposal: &proposal::Model,
    ) -> Result<VotesResult> {
        Ok(VotesResult {
            votes: vec![],
            to_index: None,
        })
    }
    async fn get_dao_votes(&self, dao_handler: &dao_handler::Model) -> Result<VotesResult> {
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
            .as_u64();

        let from_block = dao_handler.votes_index as u64;
        let to_block = if dao_handler.votes_index as u64 + dao_handler.votes_refresh_speed as u64
            > current_block
        {
            current_block
        } else {
            dao_handler.votes_index as u64 + dao_handler.votes_refresh_speed as u64
        };

        let decoder: Decoder =
            serde_json::from_value(dao_handler.clone().decoder).context("bad decoder")?;

        let address = decoder.address.parse::<Address>().context("bad address")?;

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
            //filter out some invalid spells
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

        let votes = get_votes(spell_casts.clone(), &dao_handler.clone())
            .await
            .context("bad votes")?;

        Ok(VotesResult {
            votes,
            to_index: Some(to_block as i32),
        })
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
    dao_handler: &dao_handler::Model,
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
            dao_id: Set(dao_handler.dao_id),
            dao_handler_id: Set(dao_handler.id),
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
struct SpellCast {
    voter: String,
    spell: String,
}

async fn get_single_spell_addresses(
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

async fn get_multi_spell_addresses(logs: Vec<(LogNoteFilter, LogMeta)>) -> Result<Vec<SpellCast>> {
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
