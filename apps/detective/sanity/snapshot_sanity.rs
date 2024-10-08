use anyhow::{Context, Result};
use axum::{routing::get, Router};
use chrono::{Duration, NaiveDateTime, Utc};
use dotenv::dotenv;
use sea_orm::{
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    Set,
};
use seaorm::{
    dao, dao_handler, proposal,
    sea_orm_active_enums::{DaoHandlerEnumV4, ProposalStateEnum},
};
use serde::Deserialize;
use tokio::time;
use tracing::{info, instrument};
use utils::{
    errors::{DATABASE_CONNECTION_FAILED, DATABASE_ERROR, DATABASE_URL_NOT_SET, SANITIZE_FAILED},
    tracing::setup_tracing,
};

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

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    setup_tracing();

    let app = Router::new().route("/", get("OK"));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    info!("Health check server running on {}", 3000);

    let mut interval = time::interval(std::time::Duration::from_secs(60 * 15));

    tokio::spawn(async move {
        loop {
            interval.tick().await;
            let _ = run().await;
        }
    });

    let guard = tokio::sync::Notify::new();
    guard.notified().await;

    Ok(())
}

#[instrument]
async fn run() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect(DATABASE_URL_NOT_SET);

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context(DATABASE_CONNECTION_FAILED)?;

    snapshot_sanity_check(&db).await?;

    Ok(())
}

#[instrument(skip(db))]
pub async fn snapshot_sanity_check(db: &DatabaseConnection) -> Result<()> {
    let sanitize_from: NaiveDateTime = (Utc::now() - Duration::days(90)).naive_utc();
    let sanitize_to: NaiveDateTime = (Utc::now() - Duration::minutes(5)).naive_utc();

    let dao_handlers = dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.eq(DaoHandlerEnumV4::Snapshot))
        .all(db)
        .await
        .context(DATABASE_ERROR)?;

    for dao_handler in dao_handlers {
        sanitize(&dao_handler, sanitize_from, sanitize_to, db)
            .await
            .context(SANITIZE_FAILED)?;
    }

    Ok(())
}

#[instrument(skip(db))]
async fn sanitize(
    dao_handler: &dao_handler::Model,
    sanitize_from: chrono::NaiveDateTime,
    sanitize_to: chrono::NaiveDateTime,
    db: &DatabaseConnection,
) -> Result<()> {
    let database_proposals = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::DaoHandlerId.eq(dao_handler.id))
                .add(proposal::Column::TimeCreated.gte(sanitize_from))
                .add(proposal::Column::TimeCreated.lte(sanitize_to)),
        )
        .all(db)
        .await
        .context(DATABASE_ERROR)?;

    let dao = dao::Entity::find()
        .filter(dao::Column::Id.eq(dao_handler.dao_id))
        .one(db)
        .await
        .context(DATABASE_ERROR)?
        .context(DATABASE_ERROR)?;

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
        snapshot_space,
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

        updated_proposal.flagged = Set(true);
        updated_proposal.proposal_state = Set(ProposalStateEnum::Canceled);
        updated_proposal.time_end = Set(now);

        proposal::Entity::update(updated_proposal.clone())
            .exec(db)
            .await
            .context(DATABASE_ERROR)?;
    }

    Ok(())
}
