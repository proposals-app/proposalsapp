use anyhow::Result;
use data::seed_data;
use dotenv::dotenv;
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait,
    QueryFilter, Set,
};
use seaorm::{dao, dao_handler, dao_settings, sea_orm_active_enums::DaoHandlerEnum};
use tracing::{info, instrument};
use utils::tracing::run_with_tracing;

mod data;

#[derive(Debug, Clone)]
struct DaoSeedData {
    name: String,
    slug: String,
    hot: bool,
    handlers: Vec<HandlerData>,
    settings: SettingsData,
}

#[derive(Debug, Clone)]
struct HandlerData {
    handler_type: DaoHandlerEnum,
    governance_portal: String,
    decoder: serde_json::Value,
    refresh_enabled: bool,
    proposals_refresh_speed: i32,
    votes_refresh_speed: i32,
    proposals_index: i32,
    votes_index: i32,
}

#[derive(Debug, Clone)]
struct SettingsData {
    picture: String,
    background_color: String,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    run_with_tracing(run).await;
}

async fn run() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await?;

    seed_daos(seed_data(), &db).await?;

    Ok(())
}

#[instrument(skip(db))]
async fn seed_daos(seed_data: Vec<DaoSeedData>, db: &DatabaseConnection) -> Result<()> {
    for dao_data in seed_data {
        let dao = upsert_dao(&dao_data, db).await?;
        upsert_handlers(&dao, &dao_data.handlers, db).await?;
        upsert_settings(&dao, &dao_data.settings, db).await?;
    }

    Ok(())
}

#[instrument(skip(db))]
async fn upsert_dao(dao_data: &DaoSeedData, db: &DatabaseConnection) -> Result<dao::Model> {
    let dao = match dao::Entity::find()
        .filter(dao::Column::Name.eq(dao_data.name.clone()))
        .one(db)
        .await?
    {
        Some(d) => {
            dao::Entity::update(dao::ActiveModel {
                id: Set(d.clone().id),
                name: Set(dao_data.name.clone()),
                slug: Set(dao_data.slug.clone()),
                hot: Set(dao_data.hot),
            })
            .exec(db)
            .await?;
            d
        }
        None => {
            let dao = dao::ActiveModel {
                name: Set(dao_data.name.clone()),
                slug: Set(dao_data.slug.clone()),
                hot: Set(dao_data.hot),
                ..Default::default()
            };
            dao::Entity::insert(dao).exec(db).await?;
            dao::Entity::find()
                .filter(dao::Column::Name.eq(dao_data.name.clone()))
                .one(db)
                .await?
                .unwrap()
        }
    };
    info!("Upserted DAO: {:?}", dao);
    Ok(dao)
}

#[instrument(skip(db))]
async fn upsert_handlers(
    dao: &dao::Model,
    handlers: &[HandlerData],
    db: &DatabaseConnection,
) -> Result<()> {
    for handler_data in handlers {
        let existing_handler = dao_handler::Entity::find()
            .filter(dao_handler::Column::DaoId.eq(dao.id))
            .filter(dao_handler::Column::HandlerType.eq(handler_data.handler_type.clone()))
            .one(db)
            .await?;

        match existing_handler {
            Some(h) => {
                dao_handler::Entity::update(dao_handler::ActiveModel {
                    id: Set(h.id),
                    dao_id: Set(h.dao_id),
                    handler_type: Set(h.handler_type),
                    governance_portal: Set(handler_data.clone().governance_portal),
                    decoder: Set(handler_data.clone().decoder),
                    refresh_enabled: Set(handler_data.clone().refresh_enabled),
                    proposals_index: Set(handler_data.proposals_index),
                    proposals_refresh_speed: Set(handler_data.proposals_refresh_speed),
                    votes_index: Set(handler_data.votes_index),
                    votes_refresh_speed: Set(handler_data.votes_refresh_speed),
                })
                .exec(db)
                .await?;
            }
            None => {
                dao_handler::Entity::insert(dao_handler::ActiveModel {
                    dao_id: Set(dao.id),
                    handler_type: Set(handler_data.clone().handler_type),
                    governance_portal: Set(handler_data.clone().governance_portal),
                    decoder: Set(handler_data.clone().decoder),
                    refresh_enabled: Set(handler_data.clone().refresh_enabled),
                    proposals_index: Set(handler_data.clone().proposals_index),
                    proposals_refresh_speed: Set(handler_data.clone().proposals_refresh_speed),
                    votes_index: Set(handler_data.clone().votes_index),
                    votes_refresh_speed: Set(handler_data.clone().votes_refresh_speed),
                    ..Default::default()
                })
                .exec(db)
                .await?;
            }
        }
        info!("Upserted handler: {:?}", handler_data);
    }
    Ok(())
}

#[instrument(skip(db))]
async fn upsert_settings(
    dao: &dao::Model,
    settings: &SettingsData,
    db: &DatabaseConnection,
) -> Result<()> {
    let existing_settings = dao_settings::Entity::find()
        .filter(dao_settings::Column::DaoId.eq(dao.id))
        .one(db)
        .await?;

    match existing_settings {
        Some(s) => {
            dao_settings::Entity::update(dao_settings::ActiveModel {
                id: Set(s.id),
                dao_id: Set(dao.id),
                picture: Set(settings.picture.clone()),
                background_color: Set(settings.background_color.clone()),
                quorum_warning_email_support: Set(s.quorum_warning_email_support),
                twitter_account: NotSet,
            })
            .exec(db)
            .await?;
        }
        None => {
            dao_settings::Entity::insert(dao_settings::ActiveModel {
                dao_id: Set(dao.id),
                picture: Set(settings.picture.clone()),
                background_color: Set(settings.background_color.clone()),
                ..Default::default()
            })
            .exec(db)
            .await?;
        }
    }
    info!("Upserted settings: {:?}", settings);
    Ok(())
}
