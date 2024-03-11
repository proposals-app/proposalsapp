use crate::ChainVotesResult;
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao_handler, proposal, vote};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct GraphQLResponse {
    data: GraphQLResponseInner,
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
    created: i64,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct Decoder {
    snapshot_space: String,
}

pub async fn snapshot_votes(
    dao_handler: &dao_handler::Model,
    proposal: &proposal::Model,
) -> Result<ChainVotesResult> {
    let decoder: Decoder =
        serde_json::from_value(dao_handler.clone().decoder).context("bad decoder")?;

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
        decoder.snapshot_space,
        proposal.votes_index
    );

    let graphql_response = reqwest::Client::new()
        .get("https://hub.snapshot.org/graphql".to_string())
        .json(&serde_json::json!({"query":graphql_query}))
        .send()
        .await?
        .json::<GraphQLResponse>()
        .await?;

    let parsed_votes = parse_votes(graphql_response.data.votes, proposal).await;

    let highest_index_created = parsed_votes
        .iter()
        .map(|vote| vote.index_created.clone().take())
        .max()
        .unwrap_or_default();

    Ok({
        ChainVotesResult {
            votes: parsed_votes,
            to_index: highest_index_created,
        }
    })
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
            time_created: Set(
                NaiveDateTime::from_timestamp_millis(graphql_vote.created * 1000)
                    .expect("can not create timestart")
                    .into(),
            ),
            proposal_id: Set(proposal.id.clone()),
            proposal_external_id: Set(proposal.external_id.clone()),
            dao_handler_id: Set(proposal.dao_handler_id.clone()),
            dao_id: Set(proposal.dao_id.clone()),
        };

        parsed_votes.push(vote);
    }

    parsed_votes
}
