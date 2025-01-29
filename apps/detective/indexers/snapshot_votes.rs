use crate::{
    database::DatabaseStore,
    indexer::{Indexer, ProcessResult, VotesIndexer},
    SnapshotApiHandler,
};
use anyhow::Result;
use async_trait::async_trait;
use chrono::DateTime;
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,
};
use seaorm::{dao, dao_indexer, proposal, sea_orm_active_enums::IndexerVariant, vote};
use serde::Deserialize;
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tracing::{error, info, instrument};

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
    created: i64,
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

#[async_trait]
impl Indexer for SnapshotVotesIndexer {
    #[instrument(skip_all)]
    fn min_refresh_speed(&self) -> i32 {
        1
    }
    #[instrument(skip_all)]
    fn max_refresh_speed(&self) -> i32 {
        1000
    }
    #[instrument(skip_all)]
    fn indexer_variant(&self) -> IndexerVariant {
        IndexerVariant::SnapshotVotes
    }
    #[instrument(skip_all)]
    fn timeout(&self) -> Duration {
        Duration::from_secs(30 * 60)
    }
}

#[async_trait]
impl VotesIndexer for SnapshotVotesIndexer {
    #[instrument(skip_all)]
    async fn process_votes(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<ProcessResult> {
        info!("Processing Snapshot Votes");

        let db = DatabaseStore::connect().await?;

        let proposal_limit = (indexer.speed / 10).max(10);

        let proposals = proposal::Entity::find()
            .filter(proposal::Column::DaoId.eq(indexer.dao_id))
            .filter(
                proposal::Column::EndAt.gt(DateTime::from_timestamp(indexer.index.into(), 0)
                    .unwrap()
                    .naive_utc()),
            )
            .inner_join(dao_indexer::Entity)
            .filter(dao_indexer::Column::IndexerVariant.eq(IndexerVariant::SnapshotProposals))
            .order_by(proposal::Column::EndAt, sea_orm::Order::Asc)
            .limit(proposal_limit as u64) // hacky way to get around too many proposals in the query
            .all(&db) // indexer.speed is used both for the number of votes to pull and the number of proposals to use
            .await?; // if the query fails, they both decrease until the query works

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

        Ok(ProcessResult::Votes(votes, highest_index))
    }
}

#[instrument(skip_all)]
async fn parse_votes(
    graphql_votes: Vec<GraphQLVote>,
    indexer: &dao_indexer::Model,
) -> Result<Vec<vote::ActiveModel>> {
    graphql_votes
        .into_iter()
        .map(|v| {
            Ok(vote::ActiveModel {
                id: NotSet,
                index_created: Set(v.created.try_into().expect("Invalid timestamp")),
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
                created_at: Set(DateTime::from_timestamp_millis(v.created * 1000)
                    .expect("Invalid timestamp")
                    .naive_utc()),
                proposal_id: NotSet,
                proposal_external_id: Set(v.proposal.id),
                dao_id: Set(indexer.dao_id),
                indexer_id: Set(indexer.id),
                txid: Set(Some(v.ipfs)),
            })
        })
        .collect()
}

#[cfg(test)]
mod snapshot_votes_tests {
    use crate::snapshot_api::{SnapshotApiConfig, SnapshotApiHandler};

    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use std::sync::Arc;
    use utils::test_utils::{assert_vote, parse_datetime, ExpectedVote};

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn snapshot_aave() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("08b12b74-33fa-43a7-963e-2ca5f54b1a45").unwrap(),
            indexer_variant: IndexerVariant::SnapshotProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 1718819228,
            dao_id: Uuid::parse_str("d86b6b16-9a0f-40ef-82cf-4f2d9e946612").unwrap(),
            updated_at: chrono::Utc::now().naive_utc(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("d86b6b16-9a0f-40ef-82cf-4f2d9e946612").unwrap(),
            name: "Aave".into(),
            slug: "aave".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        let snapshot_api_handler = Arc::new(SnapshotApiHandler::new(SnapshotApiConfig::default()));
        let snapshot_indexer = SnapshotVotesIndexer::new(snapshot_api_handler);

        match snapshot_indexer.process_votes(&indexer, &dao).await {
            Ok(ProcessResult::Votes(votes, _)) => {
                assert!(!votes.is_empty(), "No votes were fetched");
                let expected_votes = [ExpectedVote {
                    index_created: 1718821336,
                    voter_address: "0xECC2a9240268BC7a26386ecB49E1Befca2706AC9",
                    choice: json!(0),
                    voting_power: 39804.49649036,
                    reason: Some(""),
                    proposal_external_id:
                        "0xb74537a0528f484e9cc76d8c7931eedef7b6290e7d2dc725b2c98e623a214f95",
                    time_created: Some(parse_datetime("2024-06-19 18:22:16")),
                    block_created: None,
                    txid: Some("bafkreibcyk5ej57kvosdepk3yd5skuul7hzd5yiwhrqyzx4zeybiwn2axy"),
                }];
                for (vote, expected) in votes.iter().zip(expected_votes.iter()) {
                    assert_vote(vote, expected);
                }
            }
            _ => panic!("Failed to index"),
        }
    }
}
