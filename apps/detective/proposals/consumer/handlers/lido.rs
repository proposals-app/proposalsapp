use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use contracts::gen::lido_aragon_voting::{lido_aragon_voting::lido_aragon_voting, StartVoteFilter};
use ethers::prelude::*;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde_json::json;
use std::sync::Arc;

pub struct LidoHandler;

#[async_trait]
impl ProposalHandler for LidoHandler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        _dao: &dao::Model,
    ) -> Result<ProposalsResult> {
        let eth_rpc_url = std::env::var("ETHEREUM_NODE_URL").expect("Ethereum node not set!");
        let eth_rpc = Arc::new(Provider::<Http>::try_from(eth_rpc_url).unwrap());

        let current_block = eth_rpc
            .get_block_number()
            .await
            .context("bad current block")?
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

        let address = "0x2e59a20f205bb85a89c53f1936454680651e618e"
            .parse::<Address>()
            .context("bad address")?;

        let gov_contract = lido_aragon_voting::new(address, eth_rpc.clone());

        let proposal_events = gov_contract
            .start_vote_filter()
            .from_block(from_block)
            .to_block(to_block)
            .address(address.into())
            .query_with_meta()
            .await
            .context("query_with_meta")?;

        let mut result = Vec::new();

        for p in proposal_events.iter() {
            let p =
                data_for_proposal(p.clone(), &eth_rpc, dao_handler, gov_contract.clone()).await?;
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
        1_000_000
    }
}

async fn data_for_proposal(
    p: (contracts::gen::lido_aragon_voting::StartVoteFilter, LogMeta),
    rpc: &Arc<Provider<Http>>,
    dao_handler: &dao_handler::Model,
    gov_contract: lido_aragon_voting<ethers::providers::Provider<ethers::providers::Http>>,
) -> Result<proposal::ActiveModel> {
    let (log, meta): (StartVoteFilter, LogMeta) = p.clone();

    let created_block_number = meta.block_number.as_u64();

    let created_block = rpc
        .get_block(meta.block_number)
        .await
        .context("rpc.getblock")?;
    let created_block_timestamp = created_block.context("bad block")?.time()?.naive_utc();

    let proposal_external_id = log.vote_id.to_string();
    let title = format!("Vote #{}", log.vote_id);
    let body = log.metadata.to_string();
    let proposal_url = format!("https://vote.lido.fi/vote/{}", log.vote_id);
    let discussionurl = String::from("");

    let onchain_proposal = gov_contract
        .get_vote(log.vote_id)
        .call()
        .await
        .context("gov_contract.get_vote")?;

    let choices = vec!["yea", "nay"];
    let scores = vec![
        onchain_proposal.6.as_u128() as f64 / (10.0f64.powi(18)),
        onchain_proposal.7.as_u128() as f64 / (10.0f64.powi(18)),
    ];

    let scores_total = scores.iter().sum();
    let quorum = onchain_proposal.5 as f64 / (10.0f64.powi(18));

    let scores_quorum = scores.iter().sum();

    let state = if onchain_proposal.0 {
        ProposalStateEnum::Active
    } else if onchain_proposal.1 {
        ProposalStateEnum::Executed
    } else {
        ProposalStateEnum::Defeated
    };

    let voting_starts_timestamp =
        NaiveDateTime::from_timestamp_millis(onchain_proposal.2 as i64 * 1000).unwrap();

    let voting_time = gov_contract
        .vote_time()
        .call()
        .await
        .context("gov_contract.vote_time")?;

    let voting_ends_timestamp = NaiveDateTime::from_timestamp_millis(
        (onchain_proposal.2 as i64 + voting_time as i64) * 1000,
    )
    .unwrap();

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
    })
}

#[cfg(test)]
mod lido_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV2};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn lido_1() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV2::AaveV3Mainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 18271583,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match LidoHandler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "165",
                    name: "Vote #165",
                    body_contains: vec!["Omnibus vote: 1) Add node operator A41 with reward address `0x2A64944eBFaFF8b6A0d07B222D3d83ac29c241a7`;\n 2) Add node operator Develp GmbH with reward address `0x0a6a0b60fFeF196113b3530781df6e747DdC565e`;\n 3) Add node operator Ebunker with reward address `0x2A2245d1f47430b9f60adCFC63D158021E80A728`;\n 4) Add node operator Gateway.fm AS with reward address `0x78CEE97C23560279909c0215e084dB293F036774`;\n 5) Add node operator Numic with reward address `0x0209a89b6d9F707c14eB6cD4C3Fb519280a7E1AC`;\n 6) Add node operator ParaFi Technologies LLC with reward address `0x5Ee590eFfdf9456d5666002fBa05fbA8C3752CB7`;\n 7) Add node operator RockawayX Infra with reward address `0xcA6817DAb36850D58375A10c78703CE49d41D25a`;\n 8) Grant STAKING_MODULE_MANAGE_ROLE to Lido Agent;\n 9) Set Jump Crypto targetValidatorsLimits to 0;\n 10) Update Anchor Vault implementation from `0x07BE9BB2B1789b8F5B2f9345F18378A8B036A171` to `0x9530708033E7262bD7c005d0e0D47D8A9184277d`.\nlidovoteipfs://bafkreiafqk57mx7mwieujnkvwukkelfdxijy2tvzr3weaooxgokqljdfv4"],
                    url: "https://vote.lido.fi/vote/165",
                    discussion_url: "",
                    choices: "[\"yea\",\"nay\"]",
                    scores: "[50305714.08549471,0.0]",
                    scores_total: 50305714.08549471,
                    scores_quorum: 50305714.08549471,
                    quorum: 0.05,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(18271583),
                    time_created: Some("2023-10-03 17:46:59"),
                    time_start: "2023-10-03 17:46:59",
                    time_end: "2023-10-06 17:46:59",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }

    #[tokio::test]
    async fn lido_2() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV2::AaveV3Mainnet),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 19069831 - 19020628,
            votes_refresh_speed: 1,
            proposals_index: 19020628,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "placeholder".into(),
            slug: "placeholder".into(),
            hot: true,
        };

        match LidoHandler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "170",
                    name: "Vote #170",
                    body_contains: vec![
                        "Grant MANAGE_MEMBERS_AND_QUORUM_ROLE on HashConsensus for AccountingOracle on Lido on Ethereum to Agent;",
                        "Add oracle member named 'ChainLayer' with address 0xc79F702202E3A6B0B6310B537E786B9ACAA19BAf to HashConsensus for ValidatorsExitBusOracle on Lido on Ethereum Oracle set;"
                    ],
                    url: "https://vote.lido.fi/vote/170",
                    discussion_url: "",
                    choices: "[\"yea\",\"nay\"]",
                    scores:  "[32191115.799568973,0.0]",
                    scores_total: 32191115.799568973,
                    scores_quorum: 32191115.799568973,
                    quorum: 0.05,
                    proposal_state: ProposalStateEnum::Defeated,
                    block_created: Some(19020629),
                    time_created: Some("2024-01-16 16:24:59"),
                    time_start: "2024-01-16 16:24:59",
                    time_end: "2024-01-19 16:24:59",
                },
                ExpectedProposal {
                    external_id: "171",
                    name: "Vote #171",
                    body_contains: vec![
                        "Grant MANAGE_MEMBERS_AND_QUORUM_ROLE on HashConsensus for AccountingOracle on Lido on Ethereum to Agent;",
                        "Remove the oracle member named 'Jump Crypto' with address 0x1d0813bf088be3047d827d98524fbf779bc25f00 from HashConsensus for AccountingOracle on Lido on Ethereum;"
                    ],
                    url: "https://vote.lido.fi/vote/171",
                    discussion_url: "",
                    choices: "[\"yea\",\"nay\"]",
                    scores:  "[50990689.46758321,0.0]",
                    scores_total: 50990689.46758321,
                    scores_quorum: 50990689.46758321,
                    quorum: 0.05,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: Some(19069831),
                    time_created: Some("2024-01-23 14:01:23"),
                    time_start: "2024-01-23 14:01:23",
                    time_end: "2024-01-26 14:01:23",
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
