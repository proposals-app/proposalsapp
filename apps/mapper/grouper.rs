use anyhow::{Context, Result};
use proposalsapp_db::models::*;
use sea_orm::EntityTrait;
use std::collections::{HashMap, HashSet};
use tracing::{error, info};
use utils::types::ProposalGroupItem;
use uuid::Uuid;

mod load;
mod matching;
mod persist;
mod url;

/// Result of the grouping operation, including which proposals were matched via URL
#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct GroupingResult {
    /// Set of proposal item IDs that were matched via URL (format: "proposal_{external_id}")
    pub url_matched_proposal_ids: HashSet<String>,
    /// Number of groups created or updated
    pub groups_count: usize,
}

/// Results from all DAOs processed by the grouper
#[derive(Debug, Default)]
pub struct AllGroupingResults {
    /// Map of DAO ID to its grouping result
    pub results: HashMap<Uuid, GroupingResult>,
}

// Public function to run from main.rs
pub async fn run_grouper_task() -> Result<AllGroupingResults> {
    let db = crate::DB
        .get()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;

    let config = crate::config::get_config();
    let category_filters = &config.grouping.dao_discourse_category_filters;

    if category_filters.is_empty() {
        info!("No category filters configured, skipping grouper initialization");
        return Ok(AllGroupingResults::default());
    }

    let daos = dao::Entity::find()
        .all(db)
        .await
        .context("Failed to fetch DAOs")?;

    let filtered_daos: Vec<_> = daos
        .into_iter()
        .filter(|dao| category_filters.contains_key(dao.slug.as_str()))
        .collect();

    info!(
        "Running grouper for {} DAOs (filtered from total DAOs)",
        filtered_daos.len()
    );

    let mut all_results = AllGroupingResults::default();

    if filtered_daos.is_empty() {
        info!("No DAOs to process, skipping grouper initialization");
        return Ok(all_results);
    }

    let grouper = match Grouper::new(db.clone()).await {
        Ok(g) => g,
        Err(e) => {
            error!("Failed to initialize grouper: {}", e);
            return Err(e);
        }
    };

    let total_daos = filtered_daos.len();
    for (idx, dao) in filtered_daos.iter().enumerate() {
        info!(
            "Processing DAO {}/{}: {} ({}) with slug: {}",
            idx + 1,
            total_daos,
            dao.name,
            dao.id,
            dao.slug
        );
        match grouper.run_grouping_for_dao(dao).await {
            Ok(result) => {
                info!(
                    "Successfully completed grouping for DAO {}/{}: {} (matched {} proposals via URL)",
                    idx + 1,
                    total_daos,
                    dao.name,
                    result.url_matched_proposal_ids.len()
                );
                all_results.results.insert(dao.id, result);
            }
            Err(e) => error!(
                "Failed to run grouping for DAO {}/{} ({}): {}",
                idx + 1,
                total_daos,
                dao.name,
                e
            ),
        }
    }

    Ok(all_results)
}

pub struct Grouper {
    db: sea_orm::DatabaseConnection,
    category_filters: HashMap<String, Vec<i32>>,
}

impl Grouper {
    pub async fn new(db: sea_orm::DatabaseConnection) -> Result<Self> {
        info!("Initializing grouper");
        let config = crate::config::get_config();
        Ok(Self {
            db,
            category_filters: config.grouping.dao_discourse_category_filters.clone(),
        })
    }

    // Main entry point - takes DAO model to avoid duplicate queries
    pub async fn run_grouping_for_dao(&self, dao: &dao::Model) -> Result<GroupingResult> {
        let dao_id = dao.id;
        info!("Starting grouping for DAO {}", dao_id);

        let dao_discourse = match self.load_dao_discourse(dao_id).await? {
            Some(dd) => dd,
            None => {
                info!("No discourse configured for DAO {}, skipping", dao.slug);
                return Ok(GroupingResult::default());
            }
        };

        info!("Loading data from database for DAO {}", dao_id);
        let proposals = self.load_proposals(dao_id).await?;
        let topics = self.load_topics(&dao.slug, &dao_discourse).await?;
        let existing_groups = self.load_groups(dao_id).await?;

        info!(
            "Loaded {} proposals, {} topics, {} existing groups",
            proposals.len(),
            topics.len(),
            existing_groups.len()
        );

        let mut groups: HashMap<Uuid, Vec<ProposalGroupItem>> = HashMap::new();
        let mut original_groups: HashMap<Uuid, serde_json::Value> = HashMap::new();
        let mut grouped_item_ids = HashSet::new();
        let existing_group_ids: HashSet<Uuid> = existing_groups.iter().map(|g| g.id).collect();

        for group in existing_groups {
            let items: Vec<ProposalGroupItem> = serde_json::from_value(group.items.clone())
                .context("Failed to deserialize group items")?;

            for item in &items {
                match item {
                    ProposalGroupItem::Proposal(p) => {
                        grouped_item_ids.insert(format!("proposal_{}", p.external_id));
                    }
                    ProposalGroupItem::Topic(t) => {
                        grouped_item_ids.insert(format!("topic_{}", t.external_id));
                    }
                }
            }

            original_groups.insert(group.id, group.items.clone());
            groups.insert(group.id, items);
        }

        let proposals_before_matching: HashSet<String> = grouped_item_ids
            .iter()
            .filter(|id| id.starts_with("proposal_"))
            .cloned()
            .collect();

        info!("===== STEP 1: Creating topic groups =====");
        self.create_topic_groups(&topics, &mut groups, &mut grouped_item_ids, dao_id)
            .await?;

        info!("===== STEP 2: Matching proposals to topic groups =====");
        self.match_proposals_to_groups(
            &proposals,
            &topics,
            &mut groups,
            &mut grouped_item_ids,
            dao_id,
        )
        .await?;

        info!("Persisting {} groups (checking for changes)", groups.len());
        self.persist_results_optimized(&groups, &original_groups, &existing_group_ids, dao_id)
            .await?;

        let url_matched_proposal_ids: HashSet<String> = grouped_item_ids
            .iter()
            .filter(|id| id.starts_with("proposal_"))
            .cloned()
            .collect();

        let total_groups = groups.len();
        let single_item_groups = groups.values().filter(|items| items.len() == 1).count();
        let multi_item_groups = groups.values().filter(|items| items.len() > 1).count();
        let newly_matched = url_matched_proposal_ids.len() - proposals_before_matching.len();

        info!(
            dao_id = %dao_id,
            total_groups = total_groups,
            single_item_groups = single_item_groups,
            multi_item_groups = multi_item_groups,
            url_matched_proposals = url_matched_proposal_ids.len(),
            newly_matched = newly_matched,
            "===== Grouping complete ====="
        );

        Ok(GroupingResult {
            url_matched_proposal_ids,
            groups_count: total_groups,
        })
    }
}

pub(crate) use url::extract_discourse_id_or_slug;
