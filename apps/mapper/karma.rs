use crate::config;
use crate::karma::api::KarmaDelegate;
use crate::karma::sync::{DelegateMapping, sync_delegates};
use alloy::primitives::Address;
use anyhow::{Context, Result};
use proposalsapp_db::models::{dao, dao_discourse};
use reqwest::Client;
use sea_orm::EntityTrait;
use tracing::{info, warn};

mod api;
mod sync;

pub async fn run_karma_task() -> Result<()> {
    let client = Client::new();
    let config = config::get_config();
    let daos = fetch_daos_with_discourse().await?;

    for (dao, maybe_dao_discourse) in daos {
        info!("Processing dao: {}", dao.slug);

        let Some(discourse) = maybe_dao_discourse else {
            continue;
        };

        let Some(karma_dao_name) = config.karma.dao_slug_to_karma_name.get(&dao.slug) else {
            warn!(slug = %dao.slug, "No karma mapping configured for DAO");
            continue;
        };

        let mut delegates = api::fetch_delegates(&client, &dao.slug, karma_dao_name).await?;

        for delegate in &mut delegates {
            let address: Address = delegate.public_address.parse()?;
            delegate.public_address = address.to_checksum(None);
        }

        let delegate_mappings = build_delegate_mappings(&delegates);

        if delegate_mappings.is_empty() {
            info!(dao_id = %dao.id, "No delegates with discourse handles");
            continue;
        }

        sync_delegates(&dao, &discourse, &delegate_mappings).await?;
    }

    Ok(())
}

fn build_delegate_mappings(delegates: &[KarmaDelegate]) -> Vec<DelegateMapping> {
    delegates
        .iter()
        .filter_map(|delegate| {
            let forum_handle = delegate
                .discourse_handles
                .as_ref()
                .and_then(|handles| handles.first())?
                .to_string();

            Some(DelegateMapping {
                address: delegate.public_address.clone(),
                ens_name: delegate.ens_name.clone(),
                forum_handle,
                is_forum_verified: delegate.is_forum_verified,
            })
        })
        .collect()
}

async fn fetch_daos_with_discourse() -> Result<Vec<(dao::Model, Option<dao_discourse::Model>)>> {
    dao::Entity::find()
        .find_with_related(dao_discourse::Entity)
        .all(crate::DB.get().unwrap())
        .await
        .context("Failed to fetch DAOs with discourse information")
        .map(|daos| {
            daos.into_iter()
                .map(|(dao, discourse)| (dao, discourse.into_iter().next()))
                .collect()
        })
}
