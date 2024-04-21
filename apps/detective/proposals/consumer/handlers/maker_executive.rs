use crate::ChainProposalsResult;
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use contracts::gen::maker_executive_gov::maker_executive_gov::maker_executive_gov;
use contracts::gen::maker_executive_gov::LogNoteFilter;
use ethers::prelude::*;
use ethers::utils::to_checksum;
use itertools::Itertools;
use scanners::etherscan::estimate_block;
use sea_orm::ActiveValue::NotSet;
use sea_orm::Set;
use seaorm::sea_orm_active_enums::ProposalState;
use seaorm::{dao_handler, proposal};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Decoder {
    address: String,
    proposalUrl: String,
}

const VOTE_MULTIPLE_ACTIONS_TOPIC: &str =
    "0xed08132900000000000000000000000000000000000000000000000000000000";
const VOTE_SINGLE_ACTION_TOPIC: &str =
    "0xa69beaba00000000000000000000000000000000000000000000000000000000";

pub async fn maker_executive_proposals(
    dao_handler: &dao_handler::Model,
) -> Result<ChainProposalsResult> {
    let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
    let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

    let current_block = eth_rpc
        .get_block_number()
        .await
        .context("get_block_number")?
        .as_u64();

    let from_block = dao_handler.proposals_index;
    let to_block = if dao_handler.proposals_index as u64
        + dao_handler.proposals_refresh_speed as u64
        > current_block
    {
        current_block
    } else {
        dao_handler.proposals_index as u64 + dao_handler.proposals_refresh_speed as u64
    };

    let decoder: Decoder = serde_json::from_value(dao_handler.decoder.clone())?;

    let address = decoder.address.parse::<Address>().context("bad address")?;

    let gov_contract = maker_executive_gov::new(address, eth_rpc.clone());

    let single_spell_events = gov_contract
        .log_note_filter()
        .topic0(vec![VOTE_SINGLE_ACTION_TOPIC.parse::<H256>()?])
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("single_spell_events")?;

    let multi_spell_events = gov_contract
        .log_note_filter()
        .topic0(vec![VOTE_MULTIPLE_ACTIONS_TOPIC.parse::<H256>()?])
        .from_block(from_block)
        .to_block(to_block)
        .address(address.into())
        .query_with_meta()
        .await
        .context("multi_spell_events")?;

    let single_spells = get_single_spell_addresses(single_spell_events, gov_contract.clone())
        .await
        .context("get_single_spell_addresses")?;
    let multi_spells = get_multi_spell_addresses(multi_spell_events)
        .await
        .context("get_multi_spell_addresses")?;

    let spell_addresses: Vec<String> = [single_spells, multi_spells]
        .concat()
        .into_iter()
        .unique()
        .collect();

    let mut result = Vec::new();

    for p in spell_addresses.iter() {
        let p = data_for_proposal(&p.clone(), &decoder, dao_handler).await?;
        result.push(p);
    }

    Ok(ChainProposalsResult {
        proposals: result,
        to_index: Some(to_block as i64),
    })
}

async fn data_for_proposal(
    spell_address: &String,
    decoder: &Decoder,
    dao_handler: &dao_handler::Model,
) -> Result<proposal::ActiveModel> {
    let proposal_url = format!("{}{}", decoder.proposalUrl, spell_address);

    let proposal_data = get_proposal_data(spell_address.clone())
        .await
        .context("get_proposal_data")?;

    let created_timestamp = NaiveDateTime::parse_from_str(
        proposal_data.clone().date.split(" GMT").next().unwrap(),
        "%a %b %d %Y %H:%M:%S",
    )
    .context("created_timestamp")?;

    let voting_starts_timestamp = created_timestamp;

    let mut voting_ends_timestamp =
        DateTime::parse_from_rfc3339(proposal_data.clone().spellData.expiration.as_str())?
            .with_timezone(&Utc)
            .naive_utc();

    let scores = proposal_data
        .spellData
        .mkrSupport
        .clone()
        .parse::<u128>()
        .clone()
        .unwrap() as f64
        / (10.0f64.powi(18));

    let scores_total = proposal_data
        .spellData
        .mkrSupport
        .clone()
        .parse::<u128>()
        .clone()
        .unwrap() as f64
        / (10.0f64.powi(18));

    let block_created = estimate_block(created_timestamp.and_utc().timestamp() as u64).await?;

    let state = if proposal_data.spellData.hasBeenCast {
        ProposalState::Executed
    } else if proposal_data.active {
        ProposalState::Active
    } else if proposal_data.spellData.hasBeenScheduled {
        ProposalState::Queued
    } else if DateTime::parse_from_rfc3339(proposal_data.clone().spellData.expiration.as_str())?
        .with_timezone(&Utc)
        < Utc::now()
    {
        ProposalState::Expired
    } else {
        ProposalState::Unknown
    };

    if state == ProposalState::Executed {
        voting_ends_timestamp =
            DateTime::parse_from_rfc3339(proposal_data.clone().spellData.dateExecuted.as_str())?
                .with_timezone(&Utc)
                .naive_utc();
    }

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(spell_address.to_string()),
        name: Set(proposal_data.title.clone()),
        body: Set(proposal_data.content.clone()),
        url: Set(proposal_url),
        discussion_url: Set(String::from("")),
        choices: Set(json!(vec!["Yes"])),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        quorum: Set(0.0f64),
        proposal_state: Set(state),
        flagged: NotSet,
        block_created: Set(Some(block_created as i64)),
        time_created: Set(Some(created_timestamp)),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(block_created as i64),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
    })
}

#[derive(Deserialize, Serialize, PartialEq, Debug)]
struct TimeData {
    height: Value,
}

#[allow(non_snake_case)]
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
struct SpellData {
    expiration: String,
    datePassed: String,
    dateExecuted: String,
    mkrSupport: String,
    hasBeenCast: bool,
    hasBeenScheduled: bool,
}

#[allow(non_snake_case)]
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
struct ProposalData {
    title: String,
    content: String,
    spellData: SpellData,
    active: bool,
    date: String,
}

const MAX_RETRIES: u32 = 10;

async fn get_proposal_data(spell_address: String) -> Result<ProposalData> {
    let client = reqwest::Client::new();

    for retries in 0..MAX_RETRIES {
        let backoff_duration = Duration::from_millis(2u64.pow(retries));

        match client
            .get(format!(
                "https://vote.makerdao.com/api/executive/{}",
                spell_address
            ))
            .header("Accept", "application/json")
            .header("User-Agent", "insomnia/2023.1.0")
            .timeout(Duration::from_secs(30))
            .send()
            .await
        {
            Ok(response) => match response.json::<ProposalData>().await {
                Ok(data) => return Ok(data),
                Err(_) if retries < MAX_RETRIES - 1 => {
                    sleep(backoff_duration).await;
                }
                Err(_) => break,
            },
            Err(_) if retries < MAX_RETRIES - 1 => {
                sleep(backoff_duration).await;
            }
            Err(_) => break,
        }
    }

    Ok(ProposalData {
        title: "Unknown".into(),
        content: "Unknown".into(),
        date: "Sat Jan 01 2000 00:00:00".into(),
        active: false,
        spellData: SpellData {
            expiration: "2000-01-01T00:00:00-00:00".into(),
            datePassed: "2000-01-01T00:00:00-00:00".into(),
            dateExecuted: "2000-01-01T00:00:00-00:00".into(),
            mkrSupport: "0".into(),
            hasBeenCast: false,
            hasBeenScheduled: false,
        },
    })
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

async fn get_single_spell_addresses(
    logs: Vec<(LogNoteFilter, LogMeta)>,
    gov_contract: maker_executive_gov<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<Vec<String>> {
    let mut spell_addresses = HashSet::new();

    for log in logs {
        let slate: [u8; 32] = *extract_desired_bytes(&log.0.fax).first().unwrap();

        let mut count: U256 = U256::from(0);

        loop {
            let address = gov_contract.slates(slate, count).await;
            match address {
                Ok(addr) => {
                    spell_addresses.insert(to_checksum(&addr, None));
                    count += U256::from(1);
                }
                Err(_) => {
                    break;
                }
            }
        }
    }

    let result = spell_addresses
        .into_iter()
        .filter(|addr| addr != "0x0000000000000000000000000000000000000000")
        .collect::<Vec<String>>();

    Ok(result)
}

async fn get_multi_spell_addresses(logs: Vec<(LogNoteFilter, LogMeta)>) -> Result<Vec<String>> {
    let mut spell_addresses = HashSet::new();

    for log in logs {
        let slates = extract_desired_bytes(&log.0.fax);

        for slate in slates {
            let spell_address = Address::from(H256::from(slate));

            spell_addresses.insert(to_checksum(&spell_address, None));
        }
    }

    let result = spell_addresses
        .into_iter()
        .filter(|addr| !addr.contains("0x00000000000"))
        .collect::<Vec<String>>();

    Ok(result)
}
