use alloy::primitives::Address;
use anyhow::{Context, Result};
use chrono::Duration;
use csv::ReaderBuilder;
use reqwest::Client;
use sea_orm::{
    prelude::Uuid, ActiveValue::NotSet, ColumnTrait, EntityTrait, IntoActiveModel, QueryFilter,
    Set, TransactionTrait,
};
use seaorm::{dao, delegate, delegate_to_discourse_user, discourse_user, voter};
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
    forum_handle: String,
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

    // Fetch all DAOs from the database
    let daos = dao::Entity::find().all(&conn).await?;

    for dao in daos {
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
                if let Err(e) = update_delegates(&conn, &dao.slug, &delegates).await {
                    error!(error = %e, "Error updating delegate: {:?}", delegate);
                }
            }
        } else {
            warn!(slug = %dao.slug, "No karma_dao_name mapping found for this slug");
        }
    }

    Ok(())
}

async fn update_delegates(
    conn: &sea_orm::DatabaseConnection,
    dao_slug: &str,
    delegates: &[KarmaDelegate],
) -> Result<(), anyhow::Error> {
    Ok(())
}

async fn update_delegates_ens(
    conn: &sea_orm::DatabaseConnection,
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
    let interval = Duration::minutes(5);
    let mut next_tick = Instant::now() + StdDuration::from_secs(interval.num_seconds() as u64);

    loop {
        if let Err(e) = fetch_karma_data(database_url).await {
            error!(error = %e, "Error fetching karma data");
        }

        sleep(next_tick.saturating_duration_since(Instant::now())).await;
        next_tick += StdDuration::from_secs(interval.num_seconds() as u64);
    }
}
