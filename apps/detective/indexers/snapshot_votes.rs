use crate::{database::DatabaseStore, indexer::Indexer, snapshot_api::SnapshotApiHandler};
use anyhow::Result;
use chrono::{DateTime, Utc};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,
};
use seaorm::{
    dao, dao_indexer, proposal,
    sea_orm_active_enums::{IndexerVariant, ProposalState},
    vote,
};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashSet, sync::Arc};
use tracing::{error, info};

#[derive(Debug, Deserialize)]
struct GraphQLResponse {
    data: GraphQLResponseInner,
}

#[derive(Deserialize, Debug)]
struct GraphQLResponseInner {
    votes: Vec<GraphQLVote>,
}

#[derive(Debug, Clone, Deserialize)]
struct GraphQLProposal {
    id: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GraphQLVote {
    voter: String,
    reason: String,
    choice: Value,
    vp: f64,
    created: i32,
    proposal: GraphQLProposal,
    ipfs: String,
}

pub struct SnapshotVotesIndexer {
    api_handler: Arc<SnapshotApiHandler>,
}

impl SnapshotVotesIndexer {
    pub fn new(api_handler: Arc<SnapshotApiHandler>) -> Self {
        Self { api_handler }
    }

    pub fn proposal_indexer_variant() -> IndexerVariant {
        IndexerVariant::SnapshotProposals
    }
}

#[async_trait::async_trait]
impl Indexer for SnapshotVotesIndexer {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
        info!("Processing Snapshot Votes");

        let db = DatabaseStore::connect().await?;

        let proposals = proposal::Entity::find()
            .filter(proposal::Column::DaoId.eq(indexer.dao_id))
            .filter(proposal::Column::SnapshotVotesFetched.eq(false))
            .inner_join(dao_indexer::Entity)
            .filter(dao_indexer::Column::IndexerVariant.eq(IndexerVariant::SnapshotProposals))
            .order_by(proposal::Column::TimeEnd, sea_orm::Order::Asc)
            .all(&db)
            .await?;

        let proposals_ext_ids: Vec<String> =
            proposals.iter().map(|p| p.external_id.clone()).collect();

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
                       votes (
                           first: {},
                           orderBy: "created",
                           orderDirection: asc,
                           where: {{
                               space: "{}",
                               proposal_in: [{}],
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
                           ipfs
                           proposal
                           {{
                                id
                           }}
                       }}
                   }}"#,
            indexer.speed,
            snapshot_space,
            proposals_ext_ids
                .iter()
                .map(|id| format!("\"{}\"", id))
                .collect::<Vec<_>>()
                .join(", "),
            indexer.index
        );

        let graphql_response: GraphQLResponse = self
            .api_handler
            .fetch("https://hub.snapshot.org/graphql", graphql_query.to_owned())
            .await?;

        let votes = parse_votes(graphql_response.data.votes.clone(), indexer)
            .await
            .map_err(|e| {
                error!("Failed to parse votes: {:?}", e);
                anyhow::anyhow!("Vote parsing error: {}", e)
            })?;

        let highest_index = votes
            .iter()
            .map(|v| v.index_created.clone().unwrap())
            .max()
            .unwrap_or(indexer.index);

        let proposals_with_votes: HashSet<String> = votes
            .iter()
            .map(|v| v.proposal_external_id.clone().unwrap())
            .collect();

        // Find the oldest proposal without new votes
        if let Some(oldest_proposal_without_votes) = proposals
            .iter()
            .find(|p| !proposals_with_votes.contains(&p.external_id))
        {
            if oldest_proposal_without_votes.proposal_state != ProposalState::Active
                && oldest_proposal_without_votes.proposal_state != ProposalState::Pending
            {
                proposal::Entity::update(proposal::ActiveModel {
                    id: Set(oldest_proposal_without_votes.id),
                    snapshot_votes_fetched: Set(Some(true)),
                    ..Default::default()
                })
                .exec(&db)
                .await?;

                info!(
                    "Marked proposal {} as fetched (no new votes)",
                    oldest_proposal_without_votes.external_id
                );
            }
        }

        Ok((vec![], votes, highest_index))
    }

    fn min_refresh_speed(&self) -> i32 {
        10
    }

    fn max_refresh_speed(&self) -> i32 {
        1000
    }
}

async fn parse_votes(
    graphql_votes: Vec<GraphQLVote>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<vote::ActiveModel>> {
    graphql_votes
        .into_iter()
        .map(|v| {
            Ok(vote::ActiveModel {
                id: NotSet,
                index_created: Set(v.created),
                voter_address: Set(v.voter),
                reason: Set(Some(v.reason)),
                choice: Set(if v.choice.is_number() {
                    (v.choice
                        .as_i64()
                        .ok_or_else(|| anyhow::anyhow!("Invalid choice value"))?
                        - 1)
                    .into()
                } else {
                    v.choice
                }),
                voting_power: Set(v.vp),
                block_created: NotSet,
                time_created: Set(Some(
                    DateTime::<Utc>::from_timestamp(v.created as i64, 0)
                        .ok_or_else(|| anyhow::anyhow!("Invalid timestamp"))?
                        .naive_utc(),
                )),
                proposal_id: NotSet,
                proposal_external_id: Set(v.proposal.id),
                dao_id: Set(indexer.dao_id),
                indexer_id: Set(indexer.id),
                txid: Set(Some(v.ipfs)),
            })
        })
        .collect()
}
