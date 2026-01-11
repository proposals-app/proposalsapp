use crate::DB;
use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use proposalsapp_db::models::{
    dao, dao_discourse, delegate, delegate_to_discourse_user, delegate_to_voter, discourse_user,
    voter,
};
use sea_orm::sea_query::{Expr, ExprTrait, OnConflict};
use sea_orm::{
    ActiveValue::NotSet, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait,
    prelude::Uuid,
};

use std::collections::{HashMap, HashSet};
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct DelegateMapping {
    pub address: String,
    pub ens_name: Option<String>,
    pub forum_handle: String,
    pub is_forum_verified: bool,
}

pub async fn sync_delegates(
    dao: &dao::Model,
    dao_discourse: &dao_discourse::Model,
    delegates: &[DelegateMapping],
) -> Result<()> {
    if delegates.is_empty() {
        return Ok(());
    }

    let db = DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
    let txn = db.begin().await.context("Failed to start transaction")?;

    let now = Utc::now().naive_utc();
    let one_hour_later = now + Duration::hours(1);

    let mut address_to_ens = HashMap::new();
    for delegate in delegates {
        address_to_ens
            .entry(delegate.address.clone())
            .or_insert_with(|| delegate.ens_name.clone());
    }

    let addresses: Vec<String> = address_to_ens.keys().cloned().collect();

    let existing_voters = voter::Entity::find()
        .filter(voter::Column::Address.is_in(addresses.clone()))
        .all(&txn)
        .await
        .context("Failed to load voters")?;

    let mut voter_by_address: HashMap<String, voter::Model> = existing_voters
        .into_iter()
        .map(|model| (model.address.clone(), model))
        .collect();

    let missing_addresses: Vec<String> = addresses
        .iter()
        .filter(|addr| !voter_by_address.contains_key(*addr))
        .cloned()
        .collect();

    if !missing_addresses.is_empty() {
        let mut new_voters = Vec::new();
        let mut new_voter_models = Vec::new();

        for address in &missing_addresses {
            let id = Uuid::new_v4();
            let ens = address_to_ens.get(address).cloned().unwrap_or(None);

            new_voters.push(voter::ActiveModel {
                id: Set(id),
                address: Set(address.clone()),
                ens: Set(ens.clone()),
                avatar: NotSet,
                updated_at: Set(now),
            });

            new_voter_models.push(voter::Model {
                id,
                address: address.clone(),
                ens,
                avatar: None,
                updated_at: now,
            });
        }

        voter::Entity::insert_many(new_voters)
            .on_conflict(
                OnConflict::column(voter::Column::Address)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(&txn)
            .await
            .context("Failed to insert new voters")?;

        for model in new_voter_models {
            voter_by_address.insert(model.address.clone(), model);
        }
    }

    let handles: Vec<String> = delegates
        .iter()
        .map(|delegate| delegate.forum_handle.to_lowercase())
        .collect();

    let discourse_users = discourse_user::Entity::find()
        .filter(discourse_user::Column::DaoDiscourseId.eq(dao_discourse.id))
        .filter(Expr::cust("LOWER(username)").is_in(handles.clone()))
        .all(&txn)
        .await
        .context("Failed to load discourse users")?;

    let discourse_user_by_handle: HashMap<String, discourse_user::Model> = discourse_users
        .into_iter()
        .map(|user| (user.username.to_lowercase(), user))
        .collect();

    let voter_ids: Vec<Uuid> = voter_by_address.values().map(|voter| voter.id).collect();
    let discourse_user_ids: Vec<Uuid> = discourse_user_by_handle
        .values()
        .map(|user| user.id)
        .collect();

    let existing_delegate_to_voter = delegate_to_voter::Entity::find()
        .filter(delegate_to_voter::Column::VoterId.is_in(voter_ids.clone()))
        .inner_join(delegate::Entity)
        .filter(delegate::Column::DaoId.eq(dao.id))
        .all(&txn)
        .await
        .context("Failed to load delegate-to-voter mappings")?;

    let existing_delegate_to_discourse = delegate_to_discourse_user::Entity::find()
        .filter(
            delegate_to_discourse_user::Column::DiscourseUserId.is_in(discourse_user_ids.clone()),
        )
        .inner_join(delegate::Entity)
        .filter(delegate::Column::DaoId.eq(dao.id))
        .all(&txn)
        .await
        .context("Failed to load delegate-to-discourse mappings")?;

    let mut delegate_by_voter: HashMap<Uuid, Uuid> = HashMap::new();
    let mut delegate_by_discourse: HashMap<Uuid, Uuid> = HashMap::new();
    let mut existing_dtv_pairs = HashSet::new();
    let mut existing_dtdu_pairs = HashSet::new();

    for mapping in existing_delegate_to_voter {
        delegate_by_voter
            .entry(mapping.voter_id)
            .or_insert(mapping.delegate_id);
        existing_dtv_pairs.insert((mapping.delegate_id, mapping.voter_id));
    }

    for mapping in existing_delegate_to_discourse {
        delegate_by_discourse
            .entry(mapping.discourse_user_id)
            .or_insert(mapping.delegate_id);
        existing_dtdu_pairs.insert((mapping.delegate_id, mapping.discourse_user_id));
    }

    let mut new_delegates = Vec::new();
    let mut dtv_targets = HashSet::new();
    let mut dtdu_targets: HashMap<(Uuid, Uuid), bool> = HashMap::new();

    for delegate in delegates {
        let voter_id = match voter_by_address.get(&delegate.address) {
            Some(voter) => voter.id,
            None => continue,
        };

        let discourse_user = discourse_user_by_handle.get(&delegate.forum_handle.to_lowercase());
        let discourse_user_id = match discourse_user {
            Some(user) => user.id,
            None => {
                warn!(
                    handle = %delegate.forum_handle,
                    dao_id = %dao.id,
                    "Discourse user not found for delegate handle"
                );
                continue;
            }
        };

        let delegate_id = delegate_by_voter
            .get(&voter_id)
            .or_else(|| delegate_by_discourse.get(&discourse_user_id))
            .copied()
            .unwrap_or_else(|| {
                let new_id = Uuid::new_v4();
                new_delegates.push(delegate::ActiveModel {
                    id: Set(new_id),
                    dao_id: Set(dao.id),
                });
                delegate_by_voter.insert(voter_id, new_id);
                delegate_by_discourse.insert(discourse_user_id, new_id);
                new_id
            });

        dtv_targets.insert((delegate_id, voter_id));
        dtdu_targets
            .entry((delegate_id, discourse_user_id))
            .and_modify(|verified| *verified = *verified || delegate.is_forum_verified)
            .or_insert(delegate.is_forum_verified);
    }

    if !new_delegates.is_empty() {
        delegate::Entity::insert_many(new_delegates)
            .exec(&txn)
            .await
            .context("Failed to insert delegates")?;
    }

    let mut new_delegate_to_voters = Vec::new();
    let mut update_delegate_to_voters = Vec::new();

    for (delegate_id, voter_id) in &dtv_targets {
        if existing_dtv_pairs.contains(&(*delegate_id, *voter_id)) {
            update_delegate_to_voters.push((*delegate_id, *voter_id));
        } else {
            new_delegate_to_voters.push(delegate_to_voter::ActiveModel {
                id: Set(Uuid::new_v4()),
                delegate_id: Set(*delegate_id),
                voter_id: Set(*voter_id),
                period_start: Set(now),
                period_end: Set(one_hour_later),
                proof: NotSet,
                verified: Set(false),
                created_at: Set(now),
            });
        }
    }

    if !new_delegate_to_voters.is_empty() {
        delegate_to_voter::Entity::insert_many(new_delegate_to_voters)
            .exec(&txn)
            .await
            .context("Failed to insert delegate-to-voter mappings")?;
    }

    for (delegate_id, voter_id) in update_delegate_to_voters {
        delegate_to_voter::Entity::update_many()
            .filter(delegate_to_voter::Column::DelegateId.eq(delegate_id))
            .filter(delegate_to_voter::Column::VoterId.eq(voter_id))
            .col_expr(
                delegate_to_voter::Column::PeriodEnd,
                Expr::value(one_hour_later),
            )
            .exec(&txn)
            .await
            .context("Failed to update delegate-to-voter mapping")?;
    }

    let mut new_delegate_to_discourse = Vec::new();
    let mut update_delegate_to_discourse = Vec::new();

    for ((delegate_id, discourse_user_id), verified) in &dtdu_targets {
        if existing_dtdu_pairs.contains(&(*delegate_id, *discourse_user_id)) {
            update_delegate_to_discourse.push((*delegate_id, *discourse_user_id, *verified));
        } else {
            new_delegate_to_discourse.push(delegate_to_discourse_user::ActiveModel {
                id: Set(Uuid::new_v4()),
                delegate_id: Set(*delegate_id),
                discourse_user_id: Set(*discourse_user_id),
                period_start: Set(now),
                period_end: Set(one_hour_later),
                proof: NotSet,
                verified: Set(*verified),
                created_at: Set(now),
            });
        }
    }

    if !new_delegate_to_discourse.is_empty() {
        delegate_to_discourse_user::Entity::insert_many(new_delegate_to_discourse)
            .exec(&txn)
            .await
            .context("Failed to insert delegate-to-discourse mappings")?;
    }

    for (delegate_id, discourse_user_id, verified) in update_delegate_to_discourse {
        delegate_to_discourse_user::Entity::update_many()
            .filter(delegate_to_discourse_user::Column::DelegateId.eq(delegate_id))
            .filter(delegate_to_discourse_user::Column::DiscourseUserId.eq(discourse_user_id))
            .col_expr(
                delegate_to_discourse_user::Column::PeriodEnd,
                Expr::value(one_hour_later),
            )
            .col_expr(
                delegate_to_discourse_user::Column::Verified,
                Expr::value(verified),
            )
            .exec(&txn)
            .await
            .context("Failed to update delegate-to-discourse mapping")?;
    }

    txn.commit().await?;

    info!(
        dao_id = %dao.id,
        delegate_count = delegates.len(),
        "Karma delegate mappings synced"
    );

    Ok(())
}
