use crate::{
    chain_data::{self, Chain},
    indexer::{Indexer, ProcessResult, ProposalsIndexer},
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
use chrono::{DateTime, NaiveDateTime, Utc};
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveValue::{self, NotSet},
    Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
};
use serde_json::json;
use std::{collections::HashSet, sync::Arc, time::Duration};
use tracing::{info, instrument};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    maker_executive_gov,
    "./abis/maker_executive_gov.json"
);

pub struct MakerExecutiveMainnetProposalsIndexer;

#[async_trait]
impl Indexer for MakerExecutiveMainnetProposalsIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        1_000_000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::MakerExecutiveMainnetProposals
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(5 * 60)
    }
}

#[async_trait::async_trait]
impl ProposalsIndexer for MakerExecutiveMainnetProposalsIndexer {
    #[instrument(skip_all)]
    async fn process_proposals(
        &self,
        indexer: &dao_indexer::Model,
        _dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Maker Executive Proposals");

        let eth_rpc = chain_data::get_chain_config(Chain::Ethereum)?
            .provider
            .clone();

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("get_block_number")? as i32;

        let from_block = indexer.index;
        let to_block = if indexer.index + indexer.speed >= current_block {
            current_block
        } else {
            indexer.index + indexer.speed
        };

        let address = address!("0a3f6849f78076aefaDf113F5BED87720274dDC0");
        let vote_single_action_topic =
            b256!("a69beaba00000000000000000000000000000000000000000000000000000000");
        let vote_multiple_actions_topic =
            b256!("ed08132900000000000000000000000000000000000000000000000000000000");

        let gov_contract = maker_executive_gov::new(address, eth_rpc.clone());

        let single_spell_events = gov_contract
            .LogNote_filter()
            .event_signature(vote_single_action_topic)
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
            .await
            .context("single_spell_events")?;

        let multi_spell_events = gov_contract
            .LogNote_filter()
            .event_signature(vote_multiple_actions_topic)
            .from_block(from_block.to_u64().unwrap())
            .to_block(to_block.to_u64().unwrap())
            .address(address)
            .query()
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
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let mut proposals = Vec::new();

        for p in spell_addresses.iter() {
            let p = data_for_proposal(p, indexer).await?;
            proposals.push(p);
        }

        proposals.sort_by(|a, b| {
            let time_a = a.time_created.as_ref();
            let time_b = b.time_created.as_ref();
            time_a.cmp(time_b)
        });

        let new_index = proposals
            .iter()
            .filter(|p| {
                matches!(
                    p.proposal_state.as_ref(),
                    ProposalState::Active | ProposalState::Pending
                )
            })
            .filter_map(|p| match &p.index_created {
                ActiveValue::Set(value) => Some(*value),
                _ => None,
            })
            .min()
            .unwrap_or(to_block);

        Ok(ProcessResult::Proposals(proposals, new_index))
    }
}

#[instrument(skip_all)]
async fn data_for_proposal(
    spell_address: &String,
    indexer: &dao_indexer::Model,
) -> Result<proposal::ActiveModel> {
    let proposal_data = get_proposal_data(spell_address.clone())
        .await
        .context("get_proposal_data")?;

    let proposal_url = format!("https://vote.makerdao.com/executive/{}", proposal_data.key);
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

    if state == ProposalState::Executed && proposal_data.clone().spellData.dateExecuted.is_some() {
        voting_ends_timestamp = DateTime::parse_from_rfc3339(
            proposal_data
                .clone()
                .spellData
                .dateExecuted
                .unwrap()
                .as_str(),
        )?
        .with_timezone(&Utc)
        .naive_utc();
    }

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(spell_address.to_string()),
        author: Set(Some(spell_address.to_string())),
        name: Set(proposal_data.title.clone()),
        body: Set(proposal_data.about.clone()),
        url: Set(proposal_url),
        discussion_url: NotSet,
        choices: Set(json!(vec!["Yes"])),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(scores_total),
        quorum: Set(0.0),
        proposal_state: Set(state),
        marked_spam: NotSet,
        block_created: Set(None),
        time_created: Set(created_timestamp),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_indexer_id: Set(indexer.clone().id),
        dao_id: Set(indexer.clone().dao_id),
        index_created: Set(0),
        txid: Set(None),
        metadata: Set(json!({"vote_type": "single-choice","quorum_choices":[0]}).into()),
    })
}

#[allow(non_snake_case)]
#[derive(serde::Deserialize, serde::Serialize, PartialEq, Debug, Clone)]
struct SpellData {
    hasBeenCast: bool,
    hasBeenScheduled: bool,
    expiration: String,
    mkrSupport: String,
    datePassed: Option<String>,
    dateExecuted: Option<String>,
}

#[allow(non_snake_case)]
#[derive(serde::Deserialize, serde::Serialize, PartialEq, Debug, Clone)]
struct ProposalData {
    title: String,
    about: String,
    key: String,
    date: String,
    active: bool,
    spellData: SpellData,
}

const MAX_RETRIES: u32 = 5;

#[instrument(skip_all)]
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
                    tokio::time::sleep(backoff_duration).await;
                }
                Err(_) => break,
            },
            Err(_) if retries < MAX_RETRIES - 1 => {
                tokio::time::sleep(backoff_duration).await;
            }
            Err(_) => break,
        }
    }

    Ok(ProposalData {
        title: "Unknown".into(),
        about: "Unknown".into(),
        date: "Sat Jan 01 2000 00:00:00".into(),
        active: false,
        key: "unknown".into(),
        spellData: SpellData {
            expiration: "2000-01-01T00:00:00-00:00".into(),
            datePassed: None,
            dateExecuted: None,
            mkrSupport: "0".into(),
            hasBeenCast: false,
            hasBeenScheduled: false,
        },
    })
}

#[instrument(skip_all)]
fn extract_desired_bytes(bytes: &[u8]) -> Vec<[u8; 32]> {
    let mut iteration = 0;
    let mut result_vec = vec![];

    loop {
        let start_index = 4 + iteration * 32;
        if bytes.len() < start_index + 32 {
            break;
        }
        let mut result: [u8; 32] = [0; 32];
        result.copy_from_slice(&bytes[start_index..(start_index + 32)]);
        result_vec.push(result);
        iteration += 1;
    }

    result_vec
}

#[instrument(skip_all)]
pub async fn get_single_spell_addresses(
    logs: Vec<(maker_executive_gov::LogNote, Log)>,
    gov_contract: maker_executive_gov::maker_executive_govInstance<
        Http<reqwest::Client>,
        Arc<ReqwestProvider>,
    >,
) -> Result<Vec<String>> {
    let mut spell_addresses = HashSet::new();

    for log in logs {
        let slate: [u8; 32] = *extract_desired_bytes(&log.0.fax).first().unwrap();

        let mut count: U256 = U256::from(0);

        loop {
            let address = gov_contract.slates(slate.into(), count).call().await;
            match address {
                Ok(addr) => {
                    spell_addresses.insert(addr._0.to_checksum(None));
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

#[instrument(skip_all)]
pub async fn get_multi_spell_addresses(
    logs: Vec<(maker_executive_gov::LogNote, Log)>,
) -> Result<Vec<String>> {
    let mut spell_addresses = HashSet::new();

    for log in logs {
        let slates = extract_desired_bytes(&log.0.fax);

        for slate in slates {
            // Take the last 20 bytes of the 32-byte slate to create an Address
            let slate_address = Address::from_slice(&slate[12..]);
            let checksummed_address = slate_address.to_checksum(None);
            spell_addresses.insert(checksummed_address);
        }
    }

    let result = spell_addresses
        .into_iter()
        .filter(|addr| !addr.contains("0x00000000000"))
        .collect::<Vec<String>>();

    Ok(result)
}

#[cfg(test)]
mod maker_executive_mainnet_proposals_tests {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[tokio::test]
    async fn maker_executive() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::MakerExecutiveMainnetProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 7000,
            index: 19372410,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
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

        match MakerExecutiveMainnetProposalsIndexer
            .process_proposals(&indexer, &dao)
            .await
        {
            Ok(ProcessResult::Proposals(proposals, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");

                let expected_proposals = [ExpectedProposal {
                    index_created: 0,
                    external_id: "0xdB2C426173e5a9c10af3CD834B87DEAad40525Ff",
                    name: "Stability Fee Changes, Spark Protocol D3M Parameter Changes, Housekeeping Actions, Spark Proxy Spell - February 22, 2024",
                    body_contains: Some(vec!["The Governance Facilitators, Sidestream, and Dewiz have placed an executive proposal into the voting system. MKR Holders should vote for this proposal if they support the following alterations to the Maker Protocol."]),
                    url: "https://vote.makerdao.com/executive/template-executive-vote-stability-fee-changes-spark-protocol-d3m-parameter-changes-housekeeping-actions-spark-proxy-spell-february-22-2024",
                    discussion_url: None,
                    choices: json!(["Yes"]),
                    scores: json!(0.0),
                    scores_total: 0.0,
                    scores_quorum: 0.0,
                    quorum: 0.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: None,
                    time_created: parse_datetime("2024-02-22 00:00:00"),
                    time_start: parse_datetime("2024-02-22 00:00:00"),
                    time_end: parse_datetime("2024-02-28 15:26:59"),
                    block_created: None,
                    txid: None,
                    metadata: json!({"vote_type": "single-choice","quorum_choices":[0]}).into(),
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
