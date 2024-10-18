use std::sync::Arc;

use crate::{database::DatabaseStore, indexer::Indexer, snapshot_api::SnapshotApiHandler};
use anyhow::Result;
use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use itertools::Itertools;
use sea_orm::{
    ActiveValue::{self, NotSet},
    ColumnTrait, Condition, EntityTrait, QueryFilter, Set,
};
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

        let sanitize_from: NaiveDateTime = (Utc::now() - Duration::days(90)).naive_utc();
        let sanitize_to: NaiveDateTime = (Utc::now() - Duration::minutes(5)).naive_utc();

        sanitize(indexer, snapshot_space, sanitize_from, sanitize_to).await?;

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
            .sorted_by(|a, b| a.index_created.as_ref().cmp(b.index_created.as_ref()))
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
            .unwrap_or(indexer.index);

        Ok((proposals, vec![], highest_index))
    }

    fn min_refresh_speed(&self) -> i32 {
        1
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
                marked_spam: Set(p.flagged.unwrap_or(false)),
                block_created: NotSet,
                time_created: Set(time_created),
                time_start: Set(time_start),
                time_end: Set(time_end),
                dao_indexer_id: Set(indexer.id),
                dao_id: Set(indexer.dao_id),
                index_created: Set(p.created),
                metadata: NotSet,
                txid: Set(Some(p.ipfs)),
            }
        })
        .collect()
}

async fn sanitize(
    indexer: &dao_indexer::Model,
    space: &str,
    sanitize_from: chrono::NaiveDateTime,
    sanitize_to: chrono::NaiveDateTime,
) -> Result<()> {
    #[derive(Debug, Deserialize)]
    struct GraphQLResponse {
        data: GraphQLResponseInner,
    }

    #[derive(Deserialize, Debug)]
    struct GraphQLResponseInner {
        proposals: Vec<GraphQLProposal>,
    }

    #[derive(Debug, Clone, Deserialize)]
    struct GraphQLProposal {
        id: String,
    }

    let db = DatabaseStore::connect().await?;

    let database_proposals = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::DaoIndexerId.eq(indexer.id))
                .add(proposal::Column::TimeCreated.gte(sanitize_from))
                .add(proposal::Column::TimeCreated.lte(sanitize_to)),
        )
        .all(&db)
        .await?;

    let graphql_query = format!(
        r#"
        {{
            proposals (
                first: 1000,
                where: {{
                    space: {:?},
                    created_gte: {},
                    created_lte: {},
                }},
                orderBy: "created",
                orderDirection: asc
            )
            {{
                id
            }}
        }}
    "#,
        space,
        sanitize_from.and_utc().timestamp(),
        sanitize_to.and_utc().timestamp()
    );

    let graphql_response = reqwest::Client::new()
        .get("https://hub.snapshot.org/graphql")
        .json(&serde_json::json!({"query": graphql_query}))
        .send()
        .await?
        .json::<GraphQLResponse>()
        .await?;

    let graph_proposals: Vec<GraphQLProposal> = graphql_response.data.proposals;

    let graphql_proposal_ids: Vec<String> = graph_proposals
        .iter()
        .map(|proposal| proposal.id.clone())
        .collect();

    let proposals_to_delete: Vec<proposal::Model> = database_proposals
        .into_iter()
        .filter(|proposal| !graphql_proposal_ids.contains(&proposal.external_id))
        .collect();

    let now = Utc::now().naive_utc();

    for proposal in proposals_to_delete {
        let mut updated_proposal: proposal::ActiveModel = proposal.clone().into();

        updated_proposal.marked_spam = Set(true);
        updated_proposal.proposal_state = Set(ProposalState::Canceled);
        updated_proposal.time_end = Set(now);

        proposal::Entity::update(updated_proposal.clone())
            .exec(&db)
            .await?;
    }

    Ok(())
}

#[cfg(test)]
mod snapshot_proposals {
    use crate::snapshot_api::SnapshotApiConfig;

    use super::*;
    use dotenv::dotenv;
    use sea_orm::prelude::Uuid;
    use seaorm::{dao_indexer, sea_orm_active_enums::IndexerVariant};
    use serde_json::json;
    use std::sync::Arc;
    use utils::test_utils::{assert_proposal, parse_datetime, ExpectedProposal};

    #[ignore = "needs db mocking"]
    #[tokio::test]
    async fn snapshot_aave() {
        let _ = dotenv().ok();

        let indexer = dao_indexer::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            indexer_variant: IndexerVariant::SnapshotProposals,
            indexer_type: seaorm::sea_orm_active_enums::IndexerType::Proposals,
            portal_url: Some("placeholder".into()),
            enabled: true,
            speed: 1,
            index: 1725263866,
            dao_id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
        };

        let dao = dao::Model {
            id: Uuid::parse_str("30a57869-933c-4d24-aadb-249557cd126a").unwrap(),
            name: "Aave".into(),
            slug: "aave".into(),
            hot: true,
            picture: "placeholder".into(),
            background_color: "placeholder".into(),
            email_quorum_warning_support: true,
        };

        let snapshot_api_handler = Arc::new(SnapshotApiHandler::new(SnapshotApiConfig::default()));
        let snapshot_indexer = SnapshotProposalsIndexer::new(snapshot_api_handler);

        match snapshot_indexer.process(&indexer, &dao).await {
            Ok((proposals, _, _)) => {
                assert!(!proposals.is_empty(), "No proposals were fetched");
                let expected_proposals = [ExpectedProposal {
                    index_created: 1725263866,
                    external_id: "0xf87cf0761b27becf6c8d18bbb457c9e6bf6b7aa436cdb0d197ad2d93a495ed04",
                    name: "[TEMP CHECK] Onboard cbBTC to Aave v3 on Base",
                    body_contains: Some(vec!["The proposal aims to onboard Coinbase’s cbBTC, to the Aave v3 protocol on Base."]),
                    url: "https://snapshot.org/#/aave.eth/proposal/0xf87cf0761b27becf6c8d18bbb457c9e6bf6b7aa436cdb0d197ad2d93a495ed04",
                    discussion_url: "https://governance.aave.com/t/temp-check-onboard-cbbtc-to-aave-v3-on-base/18805/1",
                    choices: json!(["YAE", "NAY", "Abstain"]),
                    scores: json!([802818.335753119, 1430.6269857913692, 0.10106163035550476]),
                    scores_total: 804249.0638005408,
                    scores_quorum: 804249.0638005408,
                    quorum: 0.0,
                    proposal_state: ProposalState::Executed,
                    marked_spam: Some(false),
                    block_created: None,
                    time_created: parse_datetime("2024-09-02 07:57:46"),
                    time_start: parse_datetime("2024-09-03 07:57:46"),
                    time_end: parse_datetime("2024-09-06 07:57:46"),
                    txid: Some("bafkreifbwvrbt4gg4sbzckidwzowhreg2t7hxcytwmgkp42fdgtt6h57bm"),
                    metadata: None,
                }];
                for (proposal, expected) in proposals.iter().zip(expected_proposals.iter()) {
                    assert_proposal(proposal, expected);
                }
            }
            Err(e) => panic!("Failed to get proposals: {:?}", e),
        }
    }
}
