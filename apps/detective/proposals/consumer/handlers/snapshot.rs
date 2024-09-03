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
            metadata: NotSet
        };

        parsed_proposals.push(proposal);
    }

    parsed_proposals
}
