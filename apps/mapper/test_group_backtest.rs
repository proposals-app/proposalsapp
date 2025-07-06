use crate::embeddings::{self, EmbeddingCache};
use crate::grouper::get_group_title_and_body;
use crate::{DB, EMBEDDINGS, initialize_db};
use anyhow::{Context, Result};
use proposalsapp_db::models::{
    dao, dao_discourse, discourse_post, discourse_topic, proposal, proposal_group,
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use utils::types::ProposalGroupItem;

#[cfg(test)]
mod group_backtest_tests {
    use super::*;

    #[tokio::test]
    #[ignore = "Backtest that requires full database - skip in CI/CD"]
    async fn test_arbitrum_groups_semantic_matching() -> Result<()> {
        dotenv::dotenv().ok();

        // Initialize database
        initialize_db().await?;

        // Initialize embeddings with the same threshold as production
        let similarity_threshold = std::env::var("EMBEDDING_SIMILARITY_THRESHOLD")
            .unwrap_or_else(|_| "0.8".to_string())
            .parse::<f32>()
            .context("Invalid EMBEDDING_SIMILARITY_THRESHOLD")?;

        let embedding_cache = EmbeddingCache::new(similarity_threshold).await?;
        EMBEDDINGS
            .set(embedding_cache)
            .map_err(|_| anyhow::anyhow!("Failed to set embedding cache"))?;

        // Get Arbitrum DAO
        let arbitrum_dao = dao::Entity::find()
            .filter(dao::Column::Slug.eq("arbitrum"))
            .one(DB.get().unwrap())
            .await?
            .context("Arbitrum DAO not found")?;

        println!("\n=== Backtesting Arbitrum DAO Groups ===");
        println!("DAO ID: {}", arbitrum_dao.id);

        // Get all groups for Arbitrum DAO
        let groups = proposal_group::Entity::find()
            .filter(proposal_group::Column::DaoId.eq(arbitrum_dao.id))
            .all(DB.get().unwrap())
            .await?;

        println!("Found {} groups", groups.len());

        let mut total_items = 0;
        let mut successful_matches = 0;
        let mut failed_matches = 0;
        let mut failed_items = Vec::new();

        // Test each group
        for (group_idx, group) in groups.iter().enumerate() {
            println!("\n--- Group {}: {} ---", group_idx + 1, group.name);

            // Get group items
            let items = serde_json::from_value::<Vec<ProposalGroupItem>>(group.items.clone())?;

            if items.len() < 2 {
                println!("  Skipping group with only {} item(s)", items.len());
                continue;
            }

            println!("  Items in group: {}", items.len());

            // Get the group's representative content (first item)
            let (group_title, group_body) = get_group_title_and_body(group, &arbitrum_dao).await?;
            println!("  Representative: {}", group_title);

            // Test each other item in the group against the representative
            for (item_idx, item) in items.iter().enumerate().skip(1) {
                total_items += 1;

                // Get item content
                let (item_title, item_body) = match item {
                    ProposalGroupItem::Topic(topic_item) => {
                        // Get the discourse configuration
                        let dao_discourse = dao_discourse::Entity::find()
                            .filter(dao_discourse::Column::DaoId.eq(arbitrum_dao.id))
                            .one(DB.get().unwrap())
                            .await?;

                        if let Some(dao_discourse) = dao_discourse {
                            // Get the topic
                            let topic = discourse_topic::Entity::find()
                                .filter(
                                    discourse_topic::Column::ExternalId
                                        .eq(topic_item.external_id.parse::<i32>().unwrap_or(0)),
                                )
                                .filter(
                                    discourse_topic::Column::DaoDiscourseId.eq(dao_discourse.id),
                                )
                                .one(DB.get().unwrap())
                                .await?;

                            if let Some(topic) = topic {
                                // Get the first post
                                let first_post = discourse_post::Entity::find()
                                    .filter(discourse_post::Column::TopicId.eq(topic.external_id))
                                    .filter(discourse_post::Column::PostNumber.eq(1))
                                    .filter(
                                        discourse_post::Column::DaoDiscourseId.eq(dao_discourse.id),
                                    )
                                    .one(DB.get().unwrap())
                                    .await?;

                                let body = first_post.and_then(|p| p.cooked);
                                (topic.title.clone(), body)
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        }
                    }
                    ProposalGroupItem::Proposal(proposal_item) => {
                        // Get the proposal
                        let proposal = proposal::Entity::find()
                            .filter(proposal::Column::ExternalId.eq(&proposal_item.external_id))
                            .filter(proposal::Column::GovernorId.eq(proposal_item.governor_id))
                            .one(DB.get().unwrap())
                            .await?;

                        if let Some(proposal) = proposal {
                            (proposal.name.clone(), Some(proposal.body.clone()))
                        } else {
                            continue;
                        }
                    }
                };

                // Test if this item would match the group using enhanced scoring
                let embeddings = EMBEDDINGS.get().unwrap();
                let score = embeddings
                    .calculate_enhanced_similarity(
                        &item_title,
                        item_body.as_deref(),
                        &group_title,
                        group_body.as_deref(),
                    )
                    .await?;

                println!("\n  Item {}: {}", item_idx + 1, item_title);
                if !score.passes_threshold {
                    println!("    Comparing against: {}", group_title);
                    println!("    Normalized item title: {}", embeddings::EmbeddingCache::normalize_proposal_text(&item_title));
                    println!("    Normalized group title: {}", embeddings::EmbeddingCache::normalize_proposal_text(&group_title));
                }
                println!("    Title similarity: {:.3}", score.title_similarity);
                if let Some(full_sim) = score.full_similarity {
                    println!("    Full similarity: {:.3}", full_sim);
                }
                println!("    Keyword boost: {:.3}", score.keyword_boost);
                println!("    Combined score: {:.3}", score.combined_score);
                println!(
                    "    Would match: {} (threshold: {:.1})",
                    if score.passes_threshold {
                        "✅ YES"
                    } else {
                        "❌ NO"
                    },
                    if score.full_similarity.is_some() {
                        embeddings.get_body_similarity_threshold()
                    } else {
                        similarity_threshold
                    }
                );

                if score.passes_threshold {
                    successful_matches += 1;
                } else {
                    failed_matches += 1;
                    println!("    ⚠️  This item would NOT match its group!");
                    
                    // Collect failed item details
                    failed_items.push((
                        group.name.clone(),
                        item_title.clone(),
                        score.title_similarity,
                        score.full_similarity.unwrap_or(0.0),
                        score.keyword_boost,
                        score.combined_score,
                    ));
                }
            }
        }

        println!("\n=== Summary ===");
        println!("Total items tested: {}", total_items);
        println!(
            "Successful matches: {} ({:.1}%)",
            successful_matches,
            if total_items > 0 {
                (successful_matches as f32 / total_items as f32) * 100.0
            } else {
                0.0
            }
        );
        println!(
            "Failed matches: {} ({:.1}%)",
            failed_matches,
            if total_items > 0 {
                (failed_matches as f32 / total_items as f32) * 100.0
            } else {
                0.0
            }
        );

        // For a backtest, we expect most items to match their groups
        let success_rate = if total_items > 0 {
            successful_matches as f32 / total_items as f32
        } else {
            0.0
        };

        // Display all failed matches
        if !failed_items.is_empty() {
            println!("\n=== Failed Matches Details ===");
            println!("Total failed items: {}\n", failed_items.len());
            
            for (group_name, item_title, title_sim, full_sim, keyword_boost, combined_score) in &failed_items {
                println!("Group: {}", group_name);
                println!("Item:  {}", item_title);
                println!("Scores: title={:.3}, full={:.3}, keywords={:.3}, combined={:.3}",
                    title_sim, full_sim, keyword_boost, combined_score);
                println!("---");
            }
        }

        assert!(
            success_rate >= 0.8,
            "Success rate {:.1}% is below 80% threshold",
            success_rate * 100.0
        );

        Ok(())
    }
}
