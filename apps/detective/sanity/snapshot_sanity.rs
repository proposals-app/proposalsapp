use anyhow::{Context, Ok, Result};
use chrono::{Duration, NaiveDateTime, Utc};
use sea_orm::{
    ColumnTrait, Condition, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
    Set,
};
use seaorm::sea_orm_active_enums::HandlerType;
use seaorm::sea_orm_active_enums::ProposalState;
use seaorm::{dao_handler, proposal};
use serde::Deserialize;
use tracing::{info, instrument};
use utils::telemetry::setup_telemetry;

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

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct Decoder {
    snapshot_space: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    setup_telemetry();
    run().await
}

async fn run() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt)
        .await
        .context("[ERROR] Runtime.ExitError")?;

    snapshot_sanity_check(&db).await?;

    info!("DONE");

    Ok(()).map_err(|e| e.into())
}

#[instrument(skip_all)]
pub async fn snapshot_sanity_check(db: &DatabaseConnection) -> Result<()> {
    let sanitize_from: NaiveDateTime = (Utc::now() - Duration::days(90)).naive_utc();
    let sanitize_to: NaiveDateTime = (Utc::now() - Duration::minutes(5)).naive_utc();

    let dao_handlers = dao_handler::Entity::find()
        .filter(dao_handler::Column::HandlerType.eq(HandlerType::Snapshot))
        .all(db)
        .await
        .context("DB error")
        .context("[ERROR] Runtime.ExitError")?;

    for dao_handler in dao_handlers {
        sanitize(&dao_handler, sanitize_from, sanitize_to, db)
            .await
            .context("[ERROR] Runtime.ExitError")?;
    }

    Ok(())
}

#[instrument(skip_all)]
async fn sanitize(
    dao_handler: &dao_handler::Model,
    sanitize_from: chrono::NaiveDateTime,
    sanitize_to: chrono::NaiveDateTime,
    db: &DatabaseConnection,
) -> Result<()> {
    let database_proposals = proposal::Entity::find()
        .filter(
            Condition::all()
                .add(proposal::Column::DaoHandlerId.eq(dao_handler.id.clone()))
                .add(proposal::Column::TimeCreated.gte(sanitize_from))
                .add(proposal::Column::TimeCreated.lte(sanitize_to)),
        )
        .all(db)
        .await?;

    let decoder: Decoder = serde_json::from_value(dao_handler.clone().decoder)?;

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
        decoder.snapshot_space,
        sanitize_from.timestamp(),
        sanitize_to.timestamp()
    );

    let graphql_response = reqwest::Client::new()
        .get("https://hub.snapshot.org/graphql".to_string())
        .json(&serde_json::json!({"query":graphql_query}))
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
        .clone()
        .into_iter()
        .filter(|proposal| !graphql_proposal_ids.contains(&proposal.external_id))
        .collect();

    let now = Utc::now().naive_utc();

    for proposal in proposals_to_delete {
        let mut updated_proposal: proposal::ActiveModel = proposal.clone().into();

        updated_proposal.flagged = Set(1);
        updated_proposal.proposal_state = Set(ProposalState::Canceled);
        updated_proposal.time_end = Set(now);

        proposal::Entity::update(updated_proposal.clone())
            .exec(db)
            .await
            .context(format!("Sanitized proposal {:?}", updated_proposal.id))?;
    }

    Ok(())
}
