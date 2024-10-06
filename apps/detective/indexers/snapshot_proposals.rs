use std::sync::Arc;

use crate::{indexer::Indexer, snapshot_api::SnapshotApiHandler};
use anyhow::Result;
use chrono::{DateTime, Utc};
use sea_orm::{ActiveValue::NotSet, Set};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::ProposalState, vote};
use serde::Deserialize;
use tracing::info;

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
    ipfs: String,
}

pub struct SnapshotProposalsIndexer {
    api_handler: Arc<SnapshotApiHandler>,
}

impl SnapshotProposalsIndexer {
    pub fn new(api_handler: Arc<SnapshotApiHandler>) -> Self {
        Self { api_handler }
    }
}

#[async_trait::async_trait]
impl Indexer for SnapshotProposalsIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Snapshot Proposals");

        let snapshot_space = match dao.slug.as_str() {
            "compound" => "comp-vote.eth",
            "gitcoin" => "gitcoindao.eth",
            "arbitrum_dao" => "arbitrumfoundation.eth",
            "optimism" => "opcollective.eth",
            "uniswap" => "uniswapgovernance.eth",
            "hop_protocol" => "hop.eth",
            "frax" => "frax.eth",
            "dydx" => "dydxgov.eth",
            "ens" => "ens.eth",
            "aave" => "aave.eth",
            _ => {
                return Err(anyhow::anyhow!(
                    "Unsupported DAO for Snapshot - {}",
                    dao.name
                ))
            }
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
                    ipfs
                }}
            }}"#,
            indexer.speed, snapshot_space, indexer.index
        );

        let graphql_response: GraphQLResponse = self
            .api_handler
            .fetch("https://hub.snapshot.org/graphql", graphql_query.to_owned())
            .await?;

        let proposals = if let Some(data) = graphql_response.data {
            parse_proposals(data.proposals, indexer)
        } else {
            vec![]
        };

        let highest_index = proposals
            .iter()
            .map(|p| p.index_created.clone().unwrap())
            .max()
            .unwrap_or(indexer.index);

        Ok((proposals, vec![], highest_index))
    }

    fn min_refresh_speed(&self) -> i32 {
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        1000
    }
}

fn parse_proposals(
    graphql_proposals: Vec<GraphQLProposal>,
    indexer: &dao_indexer::Model,
) -> Vec<proposal::ActiveModel> {
    graphql_proposals
        .into_iter()
        .map(|p| {
            let state = match p.state.as_str() {
                "active" => ProposalState::Active,
                "pending" => ProposalState::Pending,
                "closed" => {
                    if p.scores_state == "final" {
                        ProposalState::Executed
                    } else {
                        ProposalState::Defeated
                    }
                }
                _ => ProposalState::Unknown,
            };

            let time_created = DateTime::<Utc>::from_timestamp(p.created as i64, 0)
                .expect("Invalid timestamp")
                .naive_utc();
            let time_start = DateTime::<Utc>::from_timestamp(p.start, 0)
                .expect("Invalid timestamp")
                .naive_utc();
            let time_end = DateTime::<Utc>::from_timestamp(p.end, 0)
                .expect("Invalid timestamp")
                .naive_utc();

            proposal::ActiveModel {
                id: NotSet,
                external_id: Set(p.id),
                name: Set(p.title),
                body: Set(p.body),
                url: Set(p.link),
                discussion_url: Set(p.discussion),
                choices: Set(serde_json::to_value(p.choices).unwrap()),
                scores: Set(serde_json::to_value(p.scores).unwrap()),
                scores_total: Set(p.scores_total),
                quorum: Set(p.quorum),
                scores_quorum: Set(p.scores_total),
                proposal_state: Set(state),
                flagged_spam: Set(p.flagged.unwrap_or(false)),
                block_created: NotSet,
                time_created: Set(time_created),
                time_start: Set(time_start),
                time_end: Set(time_end),
                dao_indexer_id: Set(indexer.id),
                dao_id: Set(indexer.dao_id),
                index_created: Set(p.created),
                metadata: NotSet,
                txid: Set(Some(p.ipfs)),
                snapshot_votes_fetched: Set(Some(false)),
            }
        })
        .collect()
}
