use super::{Grouper, extract_discourse_id_or_slug};
use anyhow::Result;
use proposalsapp_db::models::*;
use std::collections::{HashMap, HashSet};
use tracing::{info, warn};
use utils::types::{ProposalGroupItem, ProposalItem, TopicItem};
use uuid::Uuid;

fn build_topic_group_index(
    groups: &HashMap<Uuid, Vec<ProposalGroupItem>>,
) -> HashMap<String, Uuid> {
    let mut index = HashMap::new();

    for (group_id, items) in groups {
        for item in items {
            if let ProposalGroupItem::Topic(topic) = item {
                index.insert(topic.external_id.clone(), *group_id);
                break;
            }
        }
    }

    index
}

impl Grouper {
    pub(super) async fn create_topic_groups(
        &self,
        topics: &[discourse_topic::Model],
        groups: &mut HashMap<Uuid, Vec<ProposalGroupItem>>,
        grouped_item_ids: &mut HashSet<String>,
        dao_id: Uuid,
    ) -> Result<()> {
        info!(
            "Step 1: Creating groups for {} topics in monitored categories",
            topics.len()
        );

        let mut groups_created = 0;

        for topic in topics {
            let topic_item_id = format!("topic_{}", topic.external_id);

            if grouped_item_ids.contains(&topic_item_id) {
                continue;
            }

            let topic_item = ProposalGroupItem::Topic(TopicItem {
                name: topic.title.clone(),
                external_id: topic.external_id.to_string(),
                dao_discourse_id: topic.dao_discourse_id,
            });

            let new_group_id = Uuid::new_v4();
            groups.insert(new_group_id, vec![topic_item]);
            grouped_item_ids.insert(topic_item_id.clone());
            groups_created += 1;

            info!(
                dao_id = %dao_id,
                action = "CREATE_TOPIC_GROUP",
                topic_id = %topic_item_id,
                topic_title = %topic.title,
                group_id = %new_group_id,
                "Created new group for topic"
            );
        }

        info!(
            "Step 1 completed: Created {} new groups for topics",
            groups_created
        );
        Ok(())
    }

    pub(super) async fn match_proposals_to_groups(
        &self,
        proposals: &[proposal::Model],
        topics: &[discourse_topic::Model],
        groups: &mut HashMap<Uuid, Vec<ProposalGroupItem>>,
        grouped_item_ids: &mut HashSet<String>,
        dao_id: Uuid,
    ) -> Result<()> {
        info!(
            "Step 2: Matching {} proposals to topic groups",
            proposals.len()
        );

        let topic_by_id: HashMap<i32, &discourse_topic::Model> =
            topics.iter().map(|t| (t.external_id, t)).collect();
        let topic_by_slug: HashMap<String, &discourse_topic::Model> =
            topics.iter().map(|t| (t.slug.clone(), t)).collect();
        let topic_group_index = build_topic_group_index(groups);

        let mut matched_count = 0;
        let mut proposals_with_urls = 0;
        let mut unmatched_count = 0;

        for proposal in proposals {
            let proposal_item_id = format!("proposal_{}", proposal.external_id);

            if grouped_item_ids.contains(&proposal_item_id) {
                continue;
            }

            if let Some(discussion_url) = &proposal.discussion_url {
                if discussion_url.is_empty() {
                    continue;
                }
                proposals_with_urls += 1;

                let (extracted_id, extracted_slug) = extract_discourse_id_or_slug(discussion_url);

                let matched_topic = if let Some(id) = extracted_id {
                    topic_by_id.get(&id).copied()
                } else if let Some(slug) = extracted_slug {
                    topic_by_slug.get(&slug).copied()
                } else {
                    None
                };

                if let Some(topic) = matched_topic {
                    let topic_item_id = format!("topic_{}", topic.external_id);

                    let proposal_item = ProposalGroupItem::Proposal(ProposalItem {
                        name: proposal.name.clone(),
                        external_id: proposal.external_id.clone(),
                        governor_id: proposal.governor_id,
                    });

                    let group_id = topic_group_index.get(&topic.external_id.to_string());

                    if let Some(group_id) = group_id {
                        if let Some(group_items) = groups.get_mut(group_id) {
                            group_items.push(proposal_item);
                            grouped_item_ids.insert(proposal_item_id.clone());
                            matched_count += 1;

                            info!(
                                dao_id = %dao_id,
                                action = "MATCH_PROPOSAL_TO_GROUP",
                                proposal_id = %proposal_item_id,
                                proposal_title = %proposal.name,
                                topic_id = %topic_item_id,
                                topic_title = %topic.title,
                                group_id = %group_id,
                                discussion_url = %discussion_url,
                                "Added proposal to topic's group via discussion URL"
                            );
                        } else {
                            warn!(
                                dao_id = %dao_id,
                                action = "GROUP_NOT_FOUND",
                                proposal_id = %proposal_item_id,
                                topic_id = %topic_item_id,
                                "Matched topic but group was missing"
                            );
                        }
                    } else {
                        warn!(
                            dao_id = %dao_id,
                            action = "TOPIC_NOT_IN_GROUP",
                            proposal_id = %proposal_item_id,
                            topic_id = %topic_item_id,
                            "Found matching topic but it's not in any group"
                        );
                    }
                } else {
                    unmatched_count += 1;
                    info!(
                        dao_id = %dao_id,
                        action = "NO_TOPIC_MATCH",
                        proposal_id = %proposal_item_id,
                        proposal_title = %proposal.name,
                        discussion_url = %discussion_url,
                        "Proposal has discussion URL but no matching topic found"
                    );
                }
            }
        }

        info!(
            "Step 2 completed: Matched {} proposals to groups, {} unmatched (out of {} with discussion URLs)",
            matched_count, unmatched_count, proposals_with_urls
        );
        Ok(())
    }
}
