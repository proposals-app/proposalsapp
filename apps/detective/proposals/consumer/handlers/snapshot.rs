use crate::{ProposalHandler, ProposalsResult};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sea_orm::{NotSet, Set};
use seaorm::{dao, dao_handler, proposal, sea_orm_active_enums::ProposalStateEnum};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct GraphQLResponse {
    data: Option<GraphQLResponseInner>,
}

#[derive(Deserialize, Debug)]
struct GraphQLResponseInner {
    proposals: Vec<GraphQLProposal>,
}

#[derive(Debug, Clone, Deserialize)]
struct GraphQLProposal {
    id: String,
    title: String,
    body: String,
    discussion: String,
    choices: Vec<String>,
    scores: Vec<f64>,
    scores_total: f64,
    scores_state: String,
    created: i32,
    start: i64,
    end: i64,
    quorum: f64,
    link: String,
    state: String,
    flagged: Option<bool>,
}

pub struct SnapshotHandler;

#[async_trait]
impl ProposalHandler for SnapshotHandler {
    async fn get_proposals(
        &self,
        dao_handler: &dao_handler::Model,
        dao: &dao::Model,
    ) -> Result<ProposalsResult> {
        let snapshot_space = match dao.name.as_str() {
            "Compound" => "comp-vote.eth",
            "Gitcoin" => "gitcoindao.eth",
            "Arbitrum DAO" => "arbitrumfoundation.eth",
            "Optimism" => "opcollective.eth",
            "Uniswap" => "uniswapgovernance.eth",
            "Hop Protocol" => "hop.eth",
            "Frax" => "frax.eth",
            "dYdX" => "dydxgov.eth",
            "ENS" => "ens.eth",
            "Aave" => "aave.eth",
            _ => "unknown.eth", // Handle any other cases
        };

        let graphql_query = format!(
            r#"
            {{
                proposals (
                    first: {},
                    orderBy: "created",
                    orderDirection: asc
                    where: {{
                        space: {:?},
                        created_gte: {}
                }},
                )
                {{
                    id
                    title
                    body
                    discussion
                    choices
                    scores
                    scores_total
                    scores_state
                    created
                    start
                    end
                    quorum
                    link
                    state
                    flagged
                }}
            }}"#,
            dao_handler.proposals_refresh_speed, snapshot_space, dao_handler.proposals_index
        );

        let graphql_response = reqwest::Client::new()
            .get("https://hub.snapshot.org/graphql".to_string())
            .json(&serde_json::json!({"query":graphql_query}))
            .send()
            .await?
            .json::<GraphQLResponse>()
            .await?;

        if let Some(data) = graphql_response.data {
            let parsed_proposals = parse_proposals(data.proposals, dao_handler).await;

            let highest_index_created = parsed_proposals
                .iter()
                .map(|proposal| proposal.index_created.clone().take())
                .max()
                .unwrap_or_default();

            Ok(ProposalsResult {
                proposals: parsed_proposals,
                to_index: highest_index_created,
            })
        } else {
            Ok(ProposalsResult {
                proposals: vec![],
                to_index: None,
            })
        }
    }

    fn min_refresh_speed(&self) -> i32 {
        1
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000
    }
}

async fn parse_proposals(
    graphql_proposals: Vec<GraphQLProposal>,
    dao_handler: &dao_handler::Model,
) -> Vec<proposal::ActiveModel> {
    let mut parsed_proposals: Vec<proposal::ActiveModel> = vec![];

    for graphql_proposal in graphql_proposals {
        let state = match graphql_proposal.state.as_str() {
            "active" => ProposalStateEnum::Active,
            "pending" => ProposalStateEnum::Pending,
            "closed" => {
                if graphql_proposal.scores_state == "final" {
                    ProposalStateEnum::Executed
                } else {
                    ProposalStateEnum::Hidden
                }
            }
            _ => ProposalStateEnum::Unknown,
        };

        let proposal = proposal::ActiveModel {
            id: NotSet,
            index_created: Set(graphql_proposal.created),
            external_id: Set(graphql_proposal.id),
            name: Set(graphql_proposal.title),
            proposal_state: Set(state),
            body: Set(graphql_proposal.body),
            url: Set(graphql_proposal.link),
            discussion_url: Set(graphql_proposal.discussion),
            choices: Set(graphql_proposal.choices.into()),
            scores: Set(graphql_proposal.scores.into()),
            scores_total: Set(graphql_proposal.scores_total),
            scores_quorum: Set(graphql_proposal.scores_total),
            quorum: Set(graphql_proposal.quorum),
            block_created: NotSet,
            #[allow(deprecated)]
            time_created: Set(Some(
                NaiveDateTime::from_timestamp_millis(graphql_proposal.created as i64 * 1000)
                    .context("can not create timestart")
                    .unwrap(),
            )),
            #[allow(deprecated)]
            time_start: Set(
                NaiveDateTime::from_timestamp_millis(graphql_proposal.start * 1000)
                    .context("can not create timestart")
                    .unwrap(),
            ),
            #[allow(deprecated)]
            time_end: Set(
                NaiveDateTime::from_timestamp_millis(graphql_proposal.end * 1000)
                    .context("can not create timeend")
                    .unwrap(),
            ),
            flagged: Set(graphql_proposal.flagged.is_some_and(|f| f)),
            dao_handler_id: Set(dao_handler.id.to_owned()),
            dao_id: Set(dao_handler.dao_id.to_owned()),
            votes_index: NotSet,
            votes_fetched: NotSet,
            votes_refresh_speed: NotSet,
            metadata: NotSet,
        };

        parsed_proposals.push(proposal);
    }

    parsed_proposals
}

#[cfg(test)]
mod snapshot_proposals {
    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_handler, sea_orm_active_enums::DaoHandlerEnumV3};
    use utils::test_utils::{assert_proposal, ExpectedProposal};

    #[tokio::test]
    async fn snapshot_aave() {
        let _ = dotenv().ok();

        let dao_handler = dao_handler::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            handler_type: (DaoHandlerEnumV3::Snapshot),
            governance_portal: "placeholder".into(),
            refresh_enabled: true,
            proposals_refresh_speed: 1,
            votes_refresh_speed: 1,
            proposals_index: 1725263866,
            votes_index: 0,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Aave".into(),
            slug: "aave".into(),
            hot: true,
        };

        match SnapshotHandler.get_proposals(&dao_handler, &dao).await {
            Ok(result) => {
                assert!(!result.proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    external_id: "0xf87cf0761b27becf6c8d18bbb457c9e6bf6b7aa436cdb0d197ad2d93a495ed04",
                    name: "[TEMP CHECK] Onboard cbBTC to Aave v3 on Base",
                    body_contains: vec!["The proposal aims to onboard Coinbase’s cbBTC, to the Aave v3 protocol on Base."],
                    url: "https://snapshot.org/#/aave.eth/proposal/0xf87cf0761b27becf6c8d18bbb457c9e6bf6b7aa436cdb0d197ad2d93a495ed04",
                    discussion_url:"https://governance.aave.com/t/temp-check-onboard-cbbtc-to-aave-v3-on-base/18805/1",
                    choices: "[\"YAE\",\"NAY\",\"Abstain\"]",
                    scores: "[802818.335753119,1430.6269857913692,0.10106163035550476]",
                    scores_total: 804249.0638005408,
                    scores_quorum: 804249.0638005408,
                    quorum: 0.0,
                    proposal_state: ProposalStateEnum::Executed,
                    block_created: None,
                    time_created: Some("2024-09-02 07:57:46"),
                    time_start: "2024-09-03 07:57:46",
                    time_end: "2024-09-06 07:57:46",
                    metadata: None,
                }];
                for (proposal, expected) in result.proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected, dao_handler.id, dao_handler.dao_id);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
