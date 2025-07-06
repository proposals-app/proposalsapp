use crate::embeddings::EmbeddingCache;
use crate::grouper::extract_discourse_id_or_slug;
use crate::{DB, initialize_db};
use anyhow::{Context, Result};
use proposalsapp_db::models::{
    dao, dao_discourse, discourse_post, discourse_topic, proposal, proposal_group,
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use std::collections::{HashMap, HashSet};
use utils::types::ProposalGroupItem;

#[cfg(test)]
mod group_backtest_tests {
    use super::*;

    #[tokio::test]
    #[ignore = "Backtest that requires full database - skip in CI/CD"]
    async fn test_arbitrum_groups_mapper_simulation() -> Result<()> {
        dotenv::dotenv().ok();

        // Initialize database
        initialize_db().await?;

        // Initialize embeddings with the same threshold as production
        let similarity_threshold = std::env::var("EMBEDDING_SIMILARITY_THRESHOLD")
            .unwrap_or_else(|_| "0.70".to_string())
            .parse::<f32>()
            .context("Invalid EMBEDDING_SIMILARITY_THRESHOLD")?;

        let embedding_cache = EmbeddingCache::new(similarity_threshold).await?;

        println!("\n=== Simulating Mapper Algorithm for Arbitrum DAO (Optimized) ===");

        // Get Arbitrum DAO
        let arbitrum_dao = dao::Entity::find()
            .filter(dao::Column::Slug.eq("arbitrum"))
            .one(DB.get().unwrap())
            .await?
            .context("Arbitrum DAO not found")?;

        println!("DAO ID: {}", arbitrum_dao.id);

        // Get dao discourse config
        let dao_discourse = dao_discourse::Entity::find()
            .filter(dao_discourse::Column::DaoId.eq(arbitrum_dao.id))
            .one(DB.get().unwrap())
            .await?
            .context("Arbitrum DAO discourse not configured")?;

        // Get all existing manual groups
        let manual_groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(arbitrum_dao.id))
            .all(DB.get().unwrap())
            .await?;

        println!("Found {} existing manual groups", manual_groups.len());

        // Extract all items from manual groups
        let mut all_topic_ids = HashSet::new();
        let mut all_proposal_ids = HashSet::new();
        let mut manual_group_map: HashMap<String, HashSet<String>> = HashMap::new();

        for group in &manual_groups {
            let items = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())?;
            let mut group_item_ids = HashSet::new();

            for item in items {
                match item {
                    ProposalGroupItem::Topic(topic) => {
                        let id = format!("topic:{}", topic.external_id);
                        all_topic_ids.insert(topic.external_id.parse::<i32>().unwrap_or(0));
                        group_item_ids.insert(id);
                    }
                    ProposalGroupItem::Proposal(proposal) => {
                        let id =
                            format!("proposal:{}:{}", proposal.governor_id, proposal.external_id);
                        all_proposal_ids
                            .insert((proposal.governor_id, proposal.external_id.clone()));
                        group_item_ids.insert(id);
                    }
                }
            }

            manual_group_map.insert(group.id.to_string(), group_item_ids);
        }

        println!(
            "Extracted {} topics and {} proposals from manual groups",
            all_topic_ids.len(),
            all_proposal_ids.len()
        );

        // Fetch all topics that are in manual groups, ordered by created_at
        let category_ids = vec![7, 8, 9]; // Arbitrum proposal categories
        let topics = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id))
            .filter(discourse_topic::Column::CategoryId.is_in(category_ids.clone()))
            .filter(discourse_topic::Column::ExternalId.is_in(all_topic_ids))
            .order_by_asc(discourse_topic::Column::CreatedAt)
            .all(DB.get().unwrap())
            .await?;

        println!(
            "Found {} topics to process (filtered to categories {:?})",
            topics.len(),
            category_ids
        );

        // Fetch all proposals that are in manual groups, ordered by created_at
        let mut proposals = Vec::new();
        for (governor_id, external_id) in all_proposal_ids {
            if let Some(proposal) = proposal::Entity::find()
                .filter(proposal::Column::GovernorId.eq(governor_id))
                .filter(proposal::Column::ExternalId.eq(external_id))
                .filter(proposal::Column::MarkedSpam.eq(false))
                .one(DB.get().unwrap())
                .await?
            {
                proposals.push(proposal);
            }
        }

        // Sort proposals by created_at
        proposals.sort_by_key(|p| p.created_at);

        println!("Found {} proposals to process", proposals.len());

        // Pre-fetch all discourse posts for topics (optimization)
        println!("\nPre-fetching discourse post content...");
        let mut topic_bodies: HashMap<i32, Option<String>> = HashMap::new();
        for topic in &topics {
            let first_post = discourse_post::Entity::find()
                .filter(discourse_post::Column::TopicId.eq(topic.external_id))
                .filter(discourse_post::Column::PostNumber.eq(1))
                .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse.id))
                .one(DB.get().unwrap())
                .await?;

            topic_bodies.insert(topic.external_id, first_post.and_then(|p| p.cooked));
        }

        // Pre-compute embeddings for all items (major optimization)
        println!("\nPre-computing embeddings for all items...");
        let mut items_to_embed = Vec::new();

        // Add all topics
        for topic in &topics {
            let body = topic_bodies.get(&topic.external_id).cloned().flatten();
            items_to_embed.push((
                format!("topic:{}", topic.external_id),
                topic.title.clone(),
                body,
            ));
        }

        // Add all proposals
        for proposal in &proposals {
            items_to_embed.push((
                format!("proposal:{}:{}", proposal.governor_id, proposal.external_id),
                proposal.name.clone(),
                Some(proposal.body.clone()),
            ));
        }

        let _precomputed_embeddings = embedding_cache
            .precompute_embeddings(items_to_embed)
            .await?;
        println!("Pre-computed embeddings for all items");

        // Simulate the mapper algorithm
        let mut simulated_groups: Vec<SimulatedGroup> = Vec::new();
        let mut topic_to_group: HashMap<i32, usize> = HashMap::new();

        // Phase 1: Process all topics (they always create new groups)
        println!("\n--- Phase 1: Processing Topics ---");
        for topic in &topics {
            let group = SimulatedGroup {
                name: topic.title.clone(),
                items: vec![format!("topic:{}", topic.external_id)],
                created_from: "topic".to_string(),
            };

            topic_to_group.insert(topic.external_id, simulated_groups.len());
            simulated_groups.push(group);

            println!(
                "Created group #{} from topic: {}",
                simulated_groups.len(),
                topic.title
            );
        }

        // Phase 2: Process all proposals with 3-tier system
        println!("\n--- Phase 2: Processing Proposals (with optimized matching) ---");

        for proposal in &proposals {
            println!("\nProcessing proposal: {}", proposal.name);
            let mut matched = false;

            // Tier 1: URL-based matching
            if let Some(ref discussion_url) = proposal.discussion_url {
                let (topic_id, _) = extract_discourse_id_or_slug(discussion_url);

                if let Some(tid) = topic_id {
                    if let Some(&group_idx) = topic_to_group.get(&tid) {
                        simulated_groups[group_idx].items.push(format!(
                            "proposal:{}:{}",
                            proposal.governor_id, proposal.external_id
                        ));
                        matched = true;
                        println!(
                            "  ✓ Matched via URL to group #{} (topic ID: {})",
                            group_idx + 1,
                            tid
                        );
                    }
                }
            }

            // Tier 2: Semantic similarity matching (only if name >= 20 chars)
            if !matched && proposal.name.len() >= 20 {
                // Prepare candidates from existing groups
                let mut candidates = Vec::new();
                for (idx, group) in simulated_groups.iter().enumerate() {
                    // Get representative (first item) content
                    let rep_id = &group.items[0];
                    let (rep_title, rep_body) =
                        if let Some(topic_id) = rep_id.strip_prefix("topic:") {
                            let tid = topic_id.parse::<i32>().unwrap_or(0);
                            if let Some(topic) = topics.iter().find(|t| t.external_id == tid) {
                                (
                                    topic.title.clone(),
                                    topic_bodies.get(&tid).cloned().flatten(),
                                )
                            } else {
                                continue;
                            }
                        } else if let Some(prop_id) = rep_id.strip_prefix("proposal:") {
                            let parts: Vec<&str> = prop_id.split(':').collect();
                            if parts.len() == 2 {
                                let governor_id = parts[0];
                                let external_id = parts[1];
                                if let Some(prop) = proposals.iter().find(|p| {
                                    p.governor_id.to_string() == governor_id
                                        && p.external_id == external_id
                                }) {
                                    (prop.name.clone(), Some(prop.body.clone()))
                                } else {
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        };

                    candidates.push((idx.to_string(), rep_title, rep_body));
                }

                // Use the new enhanced similarity with reranking
                if let Some((group_idx_str, score)) = embedding_cache
                    .find_most_similar_enhanced(&proposal.name, Some(&proposal.body), candidates)
                    .await?
                {
                    if score.passes_threshold {
                        let group_idx = group_idx_str.parse::<usize>().unwrap();
                        simulated_groups[group_idx].items.push(format!(
                            "proposal:{}:{}",
                            proposal.governor_id, proposal.external_id
                        ));
                        matched = true;
                        println!(
                            "  ✓ Matched via enhanced similarity to group #{}",
                            group_idx + 1
                        );
                        println!("    Title similarity: {:.3}", score.title_similarity);
                        if let Some(body_sim) = score.body_similarity {
                            println!("    Body similarity: {:.3}", body_sim);
                        }
                        if let Some(rerank) = score.rerank_score {
                            println!("    Cross-encoder score: {:.3}", rerank);
                        }
                        println!("    Combined score: {:.3}", score.combined_score);
                    }
                }
            }

            // Tier 3: Create new group
            if !matched {
                let group = SimulatedGroup {
                    name: proposal.name.clone(),
                    items: vec![format!(
                        "proposal:{}:{}",
                        proposal.governor_id, proposal.external_id
                    )],
                    created_from: "proposal".to_string(),
                };
                simulated_groups.push(group);
                println!("  ✓ Created new group #{}", simulated_groups.len());
            }
        }

        // Clear cache to free memory
        embedding_cache.clear_cache().await;

        // Compare simulated groups with manual groups
        println!("\n=== Comparing Simulated vs Manual Groups ===");

        // Convert simulated groups to comparable format
        let mut simulated_group_map: HashMap<String, HashSet<String>> = HashMap::new();
        for (idx, group) in simulated_groups.iter().enumerate() {
            simulated_group_map.insert(
                format!("sim_{}", idx),
                group.items.iter().cloned().collect(),
            );
        }

        // Find exact matches
        let mut exact_matches = 0;
        let mut partial_matches = 0;
        let mut split_groups = 0;
        let mut merged_groups = 0;

        for (manual_id, manual_items) in &manual_group_map {
            let mut matching_sim_groups = Vec::new();

            for (sim_id, sim_items) in &simulated_group_map {
                let intersection = manual_items.intersection(sim_items).count();
                if intersection > 0 {
                    matching_sim_groups.push((sim_id.clone(), intersection, sim_items.len()));
                }
            }

            if matching_sim_groups.len() == 1 {
                let (_, intersection, sim_size) = &matching_sim_groups[0];
                if *intersection == manual_items.len() && *intersection == *sim_size {
                    exact_matches += 1;
                    println!(
                        "✅ Exact match: Manual group {} perfectly recreated",
                        manual_id
                    );
                } else {
                    partial_matches += 1;
                    println!(
                        "⚠️  Partial match: Manual group {} has {}/{} items matched",
                        manual_id,
                        intersection,
                        manual_items.len()
                    );
                }
            } else if matching_sim_groups.len() > 1 {
                split_groups += 1;
                println!(
                    "🔀 Split: Manual group {} split across {} simulated groups",
                    manual_id,
                    matching_sim_groups.len()
                );
            }
        }

        // Check for merged groups
        for (sim_id, sim_items) in &simulated_group_map {
            let mut source_manual_groups = HashSet::new();

            for item in sim_items {
                for (manual_id, manual_items) in &manual_group_map {
                    if manual_items.contains(item) {
                        source_manual_groups.insert(manual_id);
                    }
                }
            }

            if source_manual_groups.len() > 1 {
                merged_groups += 1;
                println!(
                    "🔗 Merged: Simulated group {} contains items from {} manual groups",
                    sim_id,
                    source_manual_groups.len()
                );
            }
        }

        // Calculate metrics
        let total_manual_groups = manual_groups.len();
        let group_recreation_rate = exact_matches as f32 / total_manual_groups as f32;

        // Item-level accuracy
        let mut correctly_grouped_items = 0;
        let mut total_items = 0;

        for (_manual_id, manual_items) in &manual_group_map {
            for item1 in manual_items {
                for item2 in manual_items {
                    if item1 < item2 {
                        // Avoid duplicate pairs
                        total_items += 1;

                        // Check if these items are in the same simulated group
                        let mut in_same_sim_group = false;
                        for (_, sim_items) in &simulated_group_map {
                            if sim_items.contains(item1) && sim_items.contains(item2) {
                                in_same_sim_group = true;
                                break;
                            }
                        }

                        if in_same_sim_group {
                            correctly_grouped_items += 1;
                        }
                    }
                }
            }
        }

        let item_accuracy = if total_items > 0 {
            correctly_grouped_items as f32 / total_items as f32
        } else {
            0.0
        };

        // Get final cache stats
        let (cache_entries, cache_memory) = embedding_cache.cache_stats().await;

        // Summary
        println!("\n=== Summary ===");
        println!("Manual groups: {}", total_manual_groups);
        println!("Simulated groups: {}", simulated_groups.len());
        println!("\nGroup-level metrics:");
        println!(
            "  Exact matches: {} ({:.1}%)",
            exact_matches,
            exact_matches as f32 / total_manual_groups as f32 * 100.0
        );
        println!("  Partial matches: {}", partial_matches);
        println!("  Split groups: {}", split_groups);
        println!("  Merged groups: {}", merged_groups);
        println!("\nItem-level metrics:");
        println!(
            "  Correctly grouped item pairs: {} / {} ({:.1}%)",
            correctly_grouped_items,
            total_items,
            item_accuracy * 100.0
        );
        println!("\nPerformance metrics:");
        println!("  Embedding cache entries: {}", cache_entries);
        println!("  Estimated cache memory: {} KB", cache_memory / 1024);
        println!(
            "\nOverall group recreation rate: {:.1}%",
            group_recreation_rate * 100.0
        );

        // Show details of simulated groups
        if std::env::var("SHOW_GROUP_DETAILS").is_ok() {
            println!("\n=== Simulated Groups Detail ===");
            for (idx, group) in simulated_groups.iter().enumerate() {
                println!(
                    "\nGroup #{}: {} (created from: {})",
                    idx + 1,
                    group.name,
                    group.created_from
                );
                println!("  Items: {}", group.items.len());
                for item in &group.items {
                    println!("    - {}", item);
                }
            }
        }

        assert!(
            group_recreation_rate >= 0.5,
            "Group recreation rate {:.1}% is below 50% threshold",
            group_recreation_rate * 100.0
        );

        Ok(())
    }

    struct SimulatedGroup {
        name: String,
        items: Vec<String>,
        created_from: String,
    }
}
