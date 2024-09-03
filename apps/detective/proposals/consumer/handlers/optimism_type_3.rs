use crate::{ProposalHandler, ProposalsResult};
use abi::{decode, ParamType};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::{
    optimism_gov_v_6::{optimism_gov_v_6::optimism_gov_v6, ProposalCreated3Filter},
    optimism_votemodule_0x_54a_8f_cb_bf_0_5ac_1_4b_ef_78_2a_2060a8c752c7cc1_3a_5,
};
use ethers::{prelude::*, utils::to_checksum};
use scanners::optimistic_scan::estimate_timestamp;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

pub struct OptimismType3Handler;

#[async_trait]
impl ProposalHandler for OptimismType3Handler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
    ) -> Result<ProposalsResult> {
        let op_rpc_url = std::env::var("OPTIMISM_NODE_URL").expect("Optimism node not set!");
        let op_rpc = Arc::new(Provider::<Http>::try_from(op_rpc_url).unwrap());

        let current_block = op_rpc
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

        let address = "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = optimism_gov_v6::new(address, op_rpc.clone());

        let proposal_events_three = gov_contract
            .proposal_created_3_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut result = Vec::new();

        for p in proposal_events_three.iter() {
            let p = data_for_proposal_three(p.clone(), &op_rpc, dao_handler, gov_contract.clone())
                .await
                .context("data_for_proposal_two")?;
            result.push(p);
        }

        Ok(ProposalsResult {
            proposals: result,
            to_index: Some(to_block as i32),
        })
    }

    fn min_refresh_speed(&self) -> i32 {
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        10_000_000
    }
}

async fn data_for_proposal_three(
    p: (
        contracts::gen::optimism_gov_v_6::ProposalCreated3Filter,
        LogMeta,
    ),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: optimism_gov_v6<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    println!("ProposalCreated3Filter");
    let (log, meta): (ProposalCreated3Filter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();
    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.get_block")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let voting_start_block_number = gov_contract
        .proposal_snapshot(log.proposal_id)
        .await
        .context("gov_contract.proposal_snapshot")
        .unwrap()
        .as_u64();

    let voting_end_block_number = gov_contract
        .proposal_deadline(log.proposal_id)
        .await
        .context("gov_contract.proposal_deadline")
        .unwrap()
        .as_u64();

    let voting_starts_timestamp = match estimate_timestamp(voting_start_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            (created_block_timestamp.and_utc().timestamp() * 1000)
                + (voting_start_block_number as i64 - created_block_number as i64) * 2 * 1000,
        )
        .context("bad timestamp")?,
    };

    let voting_ends_timestamp = match estimate_timestamp(voting_end_block_number).await {
        Ok(r) => r,
        #[allow(deprecated)]
        Err(_) => NaiveDateTime::from_timestamp_millis(
            created_block_timestamp.and_utc().timestamp() * 1000
                + (voting_end_block_number - created_block_number) as i64 * 2 * 1000,
        )
        .context("bad timestamp")?,
    };

    let mut title = format!(
        "{:.120}",
        log.description
            .split('\n')
            .next()
            .unwrap_or("Unknown")
            .to_string()
    );

    if title.starts_with("# ") {
        title = title.split_off(2);
    }

    if title.is_empty() {
        title = "Unknown".into()
    }

    let body = log.description.to_string();

    let proposal_url = format!("https://vote.optimism.io/proposals/{}", log.proposal_id);

    let proposal_external_id = log.proposal_id.to_string();

    let voting_module = to_checksum(&log.voting_module, None);

    let mut choices: Vec<&str> = vec![];
    let mut choices_strings: Vec<String> = vec![];
    let mut scores: Vec<f64> = vec![];
    let mut scores_total: f64 = 0.0;

    if voting_module == "0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5" {
        let voting_module =
            optimism_votemodule_0x_54a_8f_cb_bf_0_5ac_1_4b_ef_78_2a_2060a8c752c7cc1_3a_5::optimism_votemodule_0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5::new(
                log.voting_module,
                rpc.clone(),
            );

        #[derive(Debug, Deserialize)]
        struct ProposalOption {
            description: String,
        }

        #[derive(Debug, Deserialize)]
        struct ProposalData {
            proposal_options: Vec<ProposalOption>,
        }

        // Define the expected types
        let types: Vec<ParamType> = vec![
            ParamType::Array(Box::new(ParamType::Tuple(vec![
                ParamType::Array(Box::new(ParamType::Address)), // targets
                ParamType::Array(Box::new(ParamType::Uint(256))), // values
                ParamType::Array(Box::new(ParamType::Bytes)),   // calldatas
                ParamType::String,                              // description
            ]))),
            ParamType::Tuple(vec![
                ParamType::Uint(8),   // maxApprovals
                ParamType::Uint(8),   // criteria
                ParamType::Address,   // budgetToken
                ParamType::Uint(128), // criteriaValue
                ParamType::Uint(128), // budgetAmount
            ]),
        ];

        // Decode the bytes using the defined types
        let decoded_proposal_data = decode(&types, &log.proposal_data)?;

        // Extract the decoded data
        let proposal_options_tokens = decoded_proposal_data[0].clone().into_array().unwrap();

        // Parse proposal options
        let proposal_options: Vec<ProposalOption> = proposal_options_tokens
            .into_iter()
            .map(|token| {
                let tokens = token.into_tuple().unwrap();
                ProposalOption {
                    description: tokens[3].clone().into_string().unwrap(),
                }
            })
            .collect();

        // Construct the proposal data
        let proposal_data = ProposalData { proposal_options };

        choices_strings = proposal_data
            .proposal_options
            .iter()
            .map(|o| o.description.clone())
            .collect();

        choices = choices_strings.iter().map(|s| s.as_str()).collect();

        let votes = voting_module
            .proposal_votes(log.proposal_id)
            .await
            .context("voting_module.proposal_votes")?;

        scores = votes
            .2
            .iter()
            .map(|o| *o as f64 / (10.0f64.powi(18)))
            .collect();

        scores_total = votes.0.as_u128() as f64 / (10.0f64.powi(18));
    }

    let scores_quorum = scores_total;

    let proposal_state = gov_contract
        .state(log.proposal_id)
        .await
        .context("gov_contract.state")?;

    let quorum = gov_contract
        .quorum(log.proposal_id)
        .await
        .context("gov_contract.quorum")?
        .as_u128() as f64
        / (10.0f64.powi(18));

    let state = match proposal_state {
        0 => ProposalStateEnum::Pending,
        1 => ProposalStateEnum::Active,
        2 => ProposalStateEnum::Canceled,
        3 => ProposalStateEnum::Defeated,
        4 => ProposalStateEnum::Succeeded,
        5 => ProposalStateEnum::Queued,
        6 => ProposalStateEnum::Expired,
        7 => ProposalStateEnum::Executed,
        _ => ProposalStateEnum::Unknown,
    };

    let discussionurl = String::from("");

    Ok(proposal::ActiveModel {
        id: NotSet,
        external_id: Set(proposal_external_id),
        name: Set(title),
        body: Set(body),
        url: Set(proposal_url),
        discussion_url: Set(discussionurl),
        choices: Set(json!(choices)),
        scores: Set(json!(scores)),
        scores_total: Set(scores_total),
        scores_quorum: Set(scores_quorum),
        quorum: Set(quorum),
        proposal_state: Set(state),
        flagged: NotSet,
        block_created: Set(Some(created_block_number as i32)),
        time_created: Set(Some(created_block_timestamp)),
        time_start: Set(voting_starts_timestamp),
        time_end: Set(voting_ends_timestamp),
        dao_handler_id: Set(dao_handler.clone().id),
        dao_id: Set(dao_handler.clone().dao_id),
        index_created: Set(created_block_number as i32),
        votes_index: NotSet,
        votes_fetched: NotSet,
        votes_refresh_speed: NotSet,
        metadata: Set(json!({"proposal_type":3, "voting_module" : voting_module}).into()),
    })
}

#[cfg(test)]
mod optimism_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV3};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn optimism_type_3() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::OpOptimismOld),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 106239374,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match OptimismType3Handler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "76298930109016961673734608568752969826843280855214969572559472848313136347131",
                    name: "Intent #3, 1M OP",
                    body_contains: vec!["Missions are meant to be specific initiatives that can be completed start-to-finish by the end of Season 4. They are not meant to fund persistent teams to provide ongoing services."],
                    url: "https://vote.optimism.io/proposals/76298930109016961673734608568752969826843280855214969572559472848313136347131",
                    discussion_url:
                        "",
                    choices:   "[\"Proposal 3A: Fueling RetroPGF Growth through Education, Collaboration, and Active Marketing\",\"Proposal 3B: Velodrome: Spread Awareness Through Direct Outreach and Onboarding\",\"Proposal 3C: BanklessDAO’s Global Campaign to spread the Optimistic vision\",\"Proposal 3D: Create and Maintain the 'Optimism Vision Reservoir'\",\"Proposal 3E: Optimistic Womxn Shinning in Blockchain\",\"Proposal 3F: Let’s take the Optimistic Vision to LATAM with Espacio Cripto\",\"Proposal 3G: Spread Optimistic values across Latam with Solow\",\"Proposal 3H: Develop the most relevant and aligned audiovisual content for the Optimism Collective\",\"Proposal 3I: ‘Thank Optimism - powered by ThriveCoin’\",\"Proposal 3J: Web3xplorer - A curated web platform to discover useful web3 apps, resources and tools\",\"Proposal 3K: Rumbo Optimista - Hacia Ethereum Mexico The Event || Optimistic Road in the way to Ethereum México The Event\"]",
                    scores: "[4211854.626345007,19951072.258246392,16735009.16762826,21950667.975205723,14387494.768303866,13984525.14221268,16591267.938347116,8759083.1631973,17442285.317520995,17172370.93850319,13763299.023214309]",
                    scores_total: 24426303.53478304,
                    scores_quorum: 24426303.53478304,
                    quorum: 11596411.6992,
                    proposal_state: ProposalStateEnum::Succeeded,
                    block_created: Some(106239374),
                    time_created: Some("2023-06-29 22:25:25"),
                    time_start: "2023-06-29 22:25:25",
                    time_end: "2023-07-13 22:25:25",
                    metadata: Some(json!({"proposal_type": 3, "voting_module": String::from("0x54A8fCBBf05ac14bEf782a2060A8C752C7CC13a5")}))
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
