use crate::{VotesHandler, VotesResult};
use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_handler, proposal, vote};
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, instrument};

#[derive(Debug, Deserialize)]
struct GraphQLResponse {
    data: Option<GraphQLResponseInner>,
}

#[derive(Deserialize, Debug)]
struct GraphQLResponseInner {
    votes: Vec<GraphQLVote>,
}

#[derive(Debug, Clone, Deserialize)]
struct GraphQLVote {
    voter: String,
    reason: String,
    choice: Value,
    vp: f64,
    vp_state: String,
    created: i32,
}

pub struct SnapshotHandler;

#[async_trait]
impl VotesHandler for SnapshotHandler {
    async fn get_dao_votes(&self, _dao_handler: &dao_handler::Model) -> Result<VotesResult> {
        Ok(VotesResult {
            votes: vec![],
            to_index: None,
        })
    }
    #[instrument(skip(self, dao), fields(dao = %dao.name))]
    async fn get_proposal_votes(
        &self,
        _dao_handler: &dao_handler::Model,
        dao: &dao::Model,
        proposal: &proposal::Model,
    ) -> Result<VotesResult> {
        info!("Fetching votes for SnapshotHandler");
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
            votes (
                first: {},
                orderBy: "created",
                orderDirection: asc,
                where: {{
                    proposal: "{}",
                    space: "{}",
                    created_gt: {}
                }}
            )
            {{
                voter
                reason
                choice
                vp
                vp_state
                created
            }}
        }}"#,
            proposal.votes_refresh_speed,
            proposal.external_id,
            snapshot_space,
            proposal.votes_index
        );

        let graphql_response = reqwest::Client::new()
            .get("https://hub.snapshot.org/graphql".to_string())
            .json(&serde_json::json!({"query":graphql_query}))
            .send()
            .await?
            .json::<GraphQLResponse>()
            .await?;

        if let Some(data) = graphql_response.data {
            let parsed_votes = parse_votes(data.votes, proposal).await;

            let highest_index_created = parsed_votes
                .iter()
                .map(|vote| vote.index_created.clone().take())
                .max()
                .unwrap_or_default();

            Ok({
                VotesResult {
                    votes: parsed_votes,
                    to_index: highest_index_created,
                }
            })
        } else {
            Ok({
                VotesResult {
                    votes: vec![],
                    to_index: None,
                }
            })
        }
    }

    fn min_refresh_speed(&self) -> i32 {
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        1_000
    }
}

async fn parse_votes(
    graphql_votes: Vec<GraphQLVote>,
    proposal: &proposal::Model,
) -> Vec<vote::ActiveModel> {
    let mut parsed_votes: Vec<vote::ActiveModel> = vec![];

    for graphql_vote in graphql_votes {
        let vote = vote::ActiveModel {
            id: NotSet,
            index_created: Set(graphql_vote.created),
            voter_address: Set(graphql_vote.voter),
            reason: Set(Some(graphql_vote.reason)),
            choice: Set(if graphql_vote.choice.is_number() {
                (graphql_vote.choice.as_i64().unwrap() - 1).into() //snapshot indexes from 1 :-/
            } else {
                graphql_vote.choice
            }),
            voting_power: Set(graphql_vote.vp),
            vp_state: Set(graphql_vote.vp_state.into()),
            block_created: NotSet,
            #[allow(deprecated)]
            time_created: Set(NaiveDateTime::from_timestamp_millis(
                graphql_vote.created as i64 * 1000,
            )
            .expect("can not create timestart")
            .into()),
            proposal_id: Set(proposal.id),
            proposal_external_id: Set(proposal.external_id.clone()),
            dao_handler_id: Set(proposal.dao_handler_id),
            dao_id: Set(proposal.dao_id),
        };

        parsed_votes.push(vote);
    }

    parsed_votes
}
