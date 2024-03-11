use anyhow::{Context, Ok, Result};
use aws_lambda_events::sqs::SqsEventObj;
use sea_orm::ActiveValue::Set;
use sea_orm::{
    ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, QueryFilter,
};
use seaorm::sea_orm_active_enums::HandlerType;
use seaorm::{dao_handler, proposal};
use tracing::info;
use utils::telemetry::setup_telemetry;
use utils::types::{VotesDeadLetterResponse, VotesTriggerEvent};

#[tokio::main]
async fn main() -> Result<(), lambda_runtime::Error> {
    setup_telemetry();
    lambda_runtime::run(lambda_runtime::service_fn(func)).await
}

async fn func(
    e: lambda_runtime::LambdaEvent<SqsEventObj<VotesTriggerEvent>>,
) -> Result<VotesDeadLetterResponse, lambda_runtime::Error> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await.context(format!(
        "[ERROR] Runtime.ExitError - {:?}",
        e.payload.records[0].body
    ))?;

    let dao_handler = dao_handler::Entity::find()
        .filter(dao_handler::Column::Id.eq(e.payload.records[0].body.dao_handler_id.clone()))
        .one(&db)
        .await
        .context("DB error")?
        .context("DAO not found")
        .context(format!(
            "[ERROR] Runtime.ExitError - {:?}",
            e.payload.records[0].body
        ))?;

    match e.payload.records[0].body.proposal_id.clone() {
        Some(proposal_id) => {
            let proposal = proposal::Entity::find()
                .filter(proposal::Column::Id.eq(proposal_id))
                .one(&db)
                .await
                .context("DB error")?
                .context("DAO not found")
                .context(format!(
                    "[ERROR] Runtime.ExitError - {:?}",
                    e.payload.records[0].body
                ))?;

            let mut new_refresh_speed = (proposal.votes_refresh_speed as f32 * 0.5) as i64;

            let min_refresh_speed = match dao_handler.handler_type {
                HandlerType::AaveV2Mainnet => 100,
                HandlerType::AaveV3Mainnet => 100,
                HandlerType::AaveV3PolygonPos => 100,
                HandlerType::AaveV3Avalanche => 100,
                HandlerType::CompoundMainnet => 100,
                HandlerType::UniswapMainnet => 100,
                HandlerType::EnsMainnet => 100,
                HandlerType::GitcoinMainnet => 100,
                HandlerType::GitcoinV2Mainnet => 100,
                HandlerType::HopMainnet => 100,
                HandlerType::DydxMainnet => 100,
                HandlerType::InterestProtocolMainnet => 100,
                HandlerType::ZeroxProtocolMainnet => 100,
                HandlerType::FraxAlphaMainnet => 100,
                HandlerType::FraxOmegaMainnet => 100,
                HandlerType::NounsProposalsMainnet => 100,
                HandlerType::MakerExecutiveMainnet => 100,
                HandlerType::MakerPollMainnet => 100,
                HandlerType::MakerPollArbitrum => 100,
                HandlerType::OpOptimism => 100,
                HandlerType::ArbCoreArbitrum => 100,
                HandlerType::ArbTreasuryArbitrum => 100,
                HandlerType::Snapshot => 1,
            };

            if new_refresh_speed < min_refresh_speed {
                new_refresh_speed = min_refresh_speed;
            }

            info!(
                "Votes refresh speed decreased to {} for proposal {}",
                new_refresh_speed, proposal.id
            );

            proposal::Entity::update(proposal::ActiveModel {
                id: Set(proposal.id.clone()),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("DB error")
            .context(format!(
                "[ERROR] Runtime.ExitError - {:?}",
                e.payload.records[0].body
            ))?;

            let response = VotesDeadLetterResponse {
                new_refresh_speed,
                dao_handler_id: dao_handler.dao_id,
                proposal_id: Some(proposal.id.clone()),
            };

            Ok(response)
                .map_err(|e| lambda_runtime::Error::from(e.context("[ERROR] Runtime.ExitError")))
        }
        None => {
            let new_refresh_speed = if dao_handler.votes_refresh_speed > 5 {
                (dao_handler.votes_refresh_speed as f32 * 0.5) as i64
            } else {
                dao_handler.votes_refresh_speed
            };

            info!(
                "Votes refresh speed decreased to {} for DAO {}",
                new_refresh_speed, dao_handler.dao_id
            );

            dao_handler::Entity::update(dao_handler::ActiveModel {
                id: Set(dao_handler.id),
                votes_refresh_speed: Set(new_refresh_speed),
                ..Default::default()
            })
            .exec(&db)
            .await
            .context("DB error")
            .context(format!(
                "[ERROR] Runtime.ExitError - {:?}",
                e.payload.records[0].body
            ))?;

            let response = VotesDeadLetterResponse {
                new_refresh_speed,
                dao_handler_id: dao_handler.dao_id,
                proposal_id: None,
            };

            Ok(response).map_err(|e| e.into())
        }
    }
}
