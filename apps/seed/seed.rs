use anyhow::Result;
use data::seed_data;
use dotenv::dotenv;
use sea_orm::ActiveValue::NotSet;
use sea_orm::{ColumnTrait, ConnectOptions, EntityTrait, QueryFilter, Set};
use sea_orm::{Database, DatabaseConnection};
use seaorm::sea_orm_active_enums::HandlerType;
use seaorm::{dao, dao_handler, dao_settings};
use utils::telemetry::setup_telemetry;

mod data;

#[derive(Debug, Clone)]
struct DaoSeedData {
    name: String,
    slug: String,
    hot: i8,
    handlers: Vec<HandlerData>,
    settings: SettingsData,
}

#[derive(Debug, Clone)]
struct HandlerData {
    handler_type: HandlerType,
    governance_portal: String,
    decoder: serde_json::Value,
    proposals_refresh_speed: i64,
    votes_refresh_speed: i64,
    proposals_index: i64,
    votes_index: i64,
}

#[derive(Debug, Clone)]
struct SettingsData {
    picture: String,
    background_color: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    setup_telemetry();
    dotenv().ok();
    run().await
}

async fn run() -> Result<()> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set!");

    let mut opt = ConnectOptions::new(database_url);
    opt.sqlx_logging(false);

    let db: DatabaseConnection = Database::connect(opt).await?;

    seed_daos(seed_data(), &db).await?;

    Ok(())
}

async fn seed_daos(seed_data: Vec<DaoSeedData>, db: &DatabaseConnection) -> Result<()> {
    for dao_data in seed_data {
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
                    hot: Set(dao_data.hot.clone()),
                })
                .exec(db)
                .await?;
                d
            }
            None => {
                let dao = dao::ActiveModel {
                    name: Set(dao_data.name.clone()),
                    slug: Set(dao_data.slug.clone()),
                    hot: Set(dao_data.hot.clone()),
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

        for handler_data in dao_data.handlers {
            let existing_handler = dao_handler::Entity::find()
                .filter(dao_handler::Column::DaoId.eq(dao.id.clone()))
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
                        proposals_index: Set(h.proposals_index),
                        proposals_refresh_speed: Set(h.proposals_refresh_speed),
                        votes_index: Set(h.votes_index),
                        votes_refresh_speed: Set(h.votes_refresh_speed),
                    })
                    .exec(db)
                    .await?;
                }
                None => {
                    dao_handler::Entity::insert(dao_handler::ActiveModel {
                        dao_id: Set(dao.id.clone()),
                        handler_type: Set(handler_data.clone().handler_type),
                        governance_portal: Set(handler_data.clone().governance_portal),
                        decoder: Set(handler_data.clone().decoder),
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
        }

        let existing_settings = dao_settings::Entity::find()
            .filter(dao_settings::Column::DaoId.eq(dao.id.clone()))
            .one(db)
            .await?;

        match existing_settings {
            Some(s) => {
                dao_settings::Entity::update(dao_settings::ActiveModel {
                    id: Set(s.id),
                    dao_id: Set(dao.id.clone()),
                    picture: Set(dao_data.settings.picture),
                    background_color: Set(dao_data.settings.background_color),
                    quorum_warning_email_support: Set(s.quorum_warning_email_support),
                    twitter_account: NotSet,
                })
                .exec(db)
                .await?;
            }
            None => {
                dao_settings::Entity::insert(dao_settings::ActiveModel {
                    dao_id: Set(dao.id),
                    picture: Set(dao_data.settings.picture),
                    background_color: Set(dao_data.settings.background_color),
                    ..Default::default()
                })
                .exec(db)
                .await?;
            }
        }
    }

    Ok(())
}
