use alloy::primitives::Address;
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use csv::ReaderBuilder;
use reqwest::Client;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, DatabaseConnection, EntityTrait,
    IntoActiveModel, QueryFilter, Set, TransactionTrait,
};
use seaorm::{
    dao, dao_discourse, delegate, delegate_to_discourse_user, delegate_to_voter, discourse_user,
    voter,
};
use serde::Deserialize;
use std::{collections::HashMap, str::FromStr, time::Duration as StdDuration};
use tokio::time::{sleep, Instant};
use tracing::{error, info, warn};

#[derive(Debug, Deserialize)]
struct KarmaDelegate {
    #[serde(rename = "ensName")]
    ens_name: String,
    #[serde(rename = "publicAddress")]
    public_address: String,
    #[serde(rename = "forumHandle")]
    forum_handle: Option<String>,
}

// Static mapping from dao.slug to karma_dao_name
lazy_static::lazy_static! {
    static ref DAO_SLUG_TO_KARMA_DAO_NAME: HashMap<&'static str, &'static str> = {
        let mut map = HashMap::new();
        map.insert("arbitrum_dao", "arbitrum");
        // Add more mappings as needed
        map
    };
}

async fn fetch_karma_data(database_url: &str) -> Result<()> {
    let client = Client::new();
    let conn = sea_orm::Database::connect(database_url).await?;

    // Fetch all DAOs along with their associated dao_discourse information
    let daos = dao::Entity::find()
        .find_with_related(dao_discourse::Entity)
        .all(&conn)
        .await?
        .into_iter()
        .map(|(dao, discourse)| (dao, discourse.into_iter().next()))
        .collect::<Vec<_>>();

    for (dao, maybe_dao_discourse) in daos {
        if let Some(discourse) = maybe_dao_discourse {
            if let Some(karma_dao_name) = DAO_SLUG_TO_KARMA_DAO_NAME.get(dao.slug.as_str()) {
                let url = format!(
                    "https://api.karmahq.xyz/api/dao/delegates/csv?name={}&period=lifetime",
                    karma_dao_name
                );

                // Fetch the CSV data
                let response = client.get(&url).send().await?;
                let body = response.text().await?;

                // Parse the CSV data
                let mut rdr = ReaderBuilder::new().from_reader(body.as_bytes());
                let delegates: Vec<KarmaDelegate> = rdr
                    .deserialize::<KarmaDelegate>()
                    .collect::<Result<Vec<_>, _>>()
                    .context("Failed to parse CSV")?
                    .into_iter()
                    .map(|delegate| {
                        // Convert public_address to checksummed version using alloy
                        if let Ok(address) = Address::from_str(delegate.public_address.as_str()) {
                            KarmaDelegate {
                                ens_name: delegate.ens_name,
                                public_address: address.to_checksum(None),
                                forum_handle: delegate.forum_handle,
                            }
                        } else {
                            warn!("Invalid Ethereum address: {}", delegate.public_address);
                            delegate
                        }
                    })
                    .collect();

                // Update voters based on delegates with ENS set
                if let Err(e) = update_delegates_ens(&conn, &delegates).await {
                    error!(error = %e, "Error updating voters from delegates");
                }

                for delegate in &delegates {
                    if let Err(e) = update_delegate(&conn, &dao, delegate, discourse.id).await {
                        error!(error = %e, "Error updating delegate: {:?}", delegate);
                    }
                }
            } else {
                warn!(slug = %dao.slug, "No dao_discourse mapping found for this slug");
            }
        }
    }

    Ok(())
}

async fn update_delegate(
    conn: &DatabaseConnection,
    dao: &dao::Model,
    delegate_data: &KarmaDelegate,
    dao_discourse_id: Uuid,
) -> Result<()> {
    // Early return if forum_handle is None
    let forum_handle = match &delegate_data.forum_handle {
        Some(handle) => handle,
        None => {
            warn!(
                "No forum handle provided for address: {}",
                delegate_data.public_address
            );
            return Ok(());
        }
    };

    // Check if the voter exists
    let voter: Option<voter::Model> = voter::Entity::find()
        .filter(voter::Column::Address.eq(delegate_data.public_address.clone()))
        .one(conn)
        .await?;

    if voter.is_none() {
        warn!(
            "Voter not found for address: {}",
            delegate_data.public_address
        );
        return Ok(());
    }

    // Check if the discourse user exists by dao_discourse_id and forum_handle
    let discourse_user: Option<discourse_user::Model> = discourse_user::Entity::find()
        .filter(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id))
        .filter(discourse_user::Column::Username.eq(forum_handle))
        .one(conn)
        .await?;

    if discourse_user.is_none() {
        warn!(
            "Discourse user not found for forum handle: {} and dao_discourse_id: {}",
            forum_handle, dao_discourse_id
        );
        return Ok(());
    }

    let voter_id = voter.as_ref().unwrap().id;
    let discourse_user_id = discourse_user.as_ref().unwrap().id;

    // Check for existing delegate via voter with period_end > now
    let mut delegate: Option<delegate::Model> = None;

    if let Some(voter) = &voter {
        delegate = delegate_to_voter::Entity::find()
            .filter(delegate_to_voter::Column::VoterId.eq(voter.id))
            .inner_join(delegate::Entity)
            .filter(delegate::Column::DaoId.eq(dao.id))
            .one(conn)
            .await?
            .map(|dtv| delegate::Model {
                id: dtv.delegate_id,
                dao_id: dao.id,
            });
    }

    // If no delegate found via voter, check for existing delegate via discourse user with period_end > now
    if delegate.is_none() {
        if let Some(discourse_user) = &discourse_user {
            delegate = delegate_to_discourse_user::Entity::find()
                .filter(delegate_to_discourse_user::Column::DiscourseUserId.eq(discourse_user.id))
                .inner_join(delegate::Entity)
                .filter(delegate::Column::DaoId.eq(dao.id))
                .one(conn)
                .await?
                .map(|dtdu| delegate::Model {
                    id: dtdu.delegate_id,
                    dao_id: dao.id,
                });
        }
    }

    let delegate: delegate::Model = if let Some(del) = delegate {
        del
    } else {
        // Create new delegate
        let new_delegate = delegate::ActiveModel {
            id: NotSet,
            dao_id: Set(dao.id),
            ..Default::default()
        };
        let last_insert_id = delegate::Entity::insert(new_delegate)
            .exec(conn)
            .await?
            .last_insert_id;
        delegate::Model {
            id: last_insert_id,
            dao_id: dao.id,
        }
    };

    let now = Utc::now().naive_utc();
    let one_hour_later = now + Duration::hours(1);

    // Insert or update the delegate_to_voter mapping
    let existing_dtv = delegate_to_voter::Entity::find()
        .filter(delegate_to_voter::Column::DelegateId.eq(delegate.id))
        .filter(delegate_to_voter::Column::VoterId.eq(voter_id))
        .one(conn)
        .await?;

    if let Some(dtv) = existing_dtv {
        // Update existing delegate_to_voter mapping
        let mut active_dtv = dtv.into_active_model();
        active_dtv.period_end = Set(one_hour_later);
        delegate_to_voter::Entity::update(active_dtv)
            .exec(conn)
            .await?;
    } else {
        // Insert new delegate_to_voter mapping
        let new_dtv = delegate_to_voter::ActiveModel {
            id: NotSet,
            delegate_id: Set(delegate.id),
            voter_id: Set(voter_id),
            period_start: Set(now),
            period_end: Set(one_hour_later),
            proof: NotSet,
            verified: Set(false),
            created_at: Set(now),
        };
        delegate_to_voter::Entity::insert(new_dtv)
            .exec(conn)
            .await?;
    }

    // Insert or update the delegate_to_discourse_user mapping
    let existing_dtdu = delegate_to_discourse_user::Entity::find()
        .filter(delegate_to_discourse_user::Column::DelegateId.eq(delegate.id))
        .filter(delegate_to_discourse_user::Column::DiscourseUserId.eq(discourse_user_id))
        .one(conn)
        .await?;

    if let Some(dtdu) = existing_dtdu {
        // Update existing delegate_to_discourse_user mapping
        let mut active_dtdu = dtdu.into_active_model();
        active_dtdu.period_end = Set(one_hour_later);
        delegate_to_discourse_user::Entity::update(active_dtdu)
            .exec(conn)
            .await?;
    } else {
        // Insert new delegate_to_discourse_user mapping
        let new_dtdu = delegate_to_discourse_user::ActiveModel {
            id: NotSet,
            delegate_id: Set(delegate.id),
            discourse_user_id: Set(discourse_user_id),
            period_start: Set(now),
            period_end: Set(one_hour_later),
            proof: NotSet,
            verified: Set(false),
            created_at: Set(now),
        };
        delegate_to_discourse_user::Entity::insert(new_dtdu)
            .exec(conn)
            .await?;
    }

    Ok(())
}

async fn update_delegates_ens(
    conn: &DatabaseConnection,
    delegates: &[KarmaDelegate],
) -> Result<()> {
    // Filter delegates with ENS set
    let filtered_delegates: Vec<&KarmaDelegate> = delegates
        .iter()
        .filter(|delegate| !delegate.ens_name.is_empty())
        .collect();

    if filtered_delegates.is_empty() {
        info!("No delegates with ENS names found.");
        return Ok(());
    }

    // Fetch voters by public addresses in batches
    let addresses: Vec<&str> = filtered_delegates
        .iter()
        .map(|delegate| delegate.public_address.as_str())
        .collect();

    let mut voters_to_update = HashMap::new();

    const BATCH_SIZE: usize = 100;
    for batch_addresses in addresses.chunks(BATCH_SIZE) {
        // Convert &str to Vec<&str>
        let chunk_voters: Vec<voter::Model> = voter::Entity::find()
            .filter(voter::Column::Address.is_in(batch_addresses.to_vec()))
            .all(conn)
            .await?;

        for voter in chunk_voters {
            voters_to_update.insert(voter.address.clone(), voter);
        }
    }

    // Prepare updates
    let mut active_voters_to_save = Vec::new();

    for delegate in filtered_delegates {
        if let Some(voter) = voters_to_update.remove(&delegate.public_address) {
            if voter
                .ens
                .as_ref()
                .map_or(true, |current_ens| current_ens != &delegate.ens_name)
            {
                // Convert Model to ActiveModel for updating
                let mut active_voter = voter.into_active_model();
                active_voter.ens = Set(Some(delegate.ens_name.clone()));
                active_voters_to_save.push(active_voter);
            }
        } else {
            warn!("No voter found with address: {}", delegate.public_address);
        }
    }

    // Batch update voters
    if !active_voters_to_save.is_empty() {
        let tx = conn.begin().await?;

        for voter in active_voters_to_save.clone() {
            voter::Entity::update(voter).exec(&tx).await?;
        }

        info!(
            "Updated ENS names for {} voters.",
            active_voters_to_save.len()
        );
        tx.commit().await?;
    } else {
        info!("No updates needed for voters.");
    }

    Ok(())
}

pub async fn run_karma_task(database_url: &str) -> Result<()> {
    let interval = Duration::minutes(10);
    let mut next_tick = Instant::now() + StdDuration::from_secs(interval.num_seconds() as u64);

    loop {
        if let Err(e) = fetch_karma_data(database_url).await {
            error!(error = %e, "Error fetching karma data");
        }

        sleep(next_tick.saturating_duration_since(Instant::now())).await;
        next_tick += StdDuration::from_secs(interval.num_seconds() as u64);
    }
}
