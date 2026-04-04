import { randomUUID } from 'node:crypto';
import {
  type ProposalGroupItem,
  getProposalItemKey,
  getTopicItemKey,
} from '../shared/group-items';
import { extractDiscourseIdOrSlug } from './url';

export interface TopicRecord {
  id: string;
  externalId: number;
  daoDiscourseId: string;
  title: string;
  slug: string;
  categoryId: number;
  createdAt: Date;
}

export interface ProposalRecord {
  id: string;
  externalId: string;
  governorId: string;
  name: string;
  discussionUrl: string | null;
  createdAt: Date;
}

export interface ProposalGroupRecord {
  id: string;
  daoId: string;
  name: string;
  items: ProposalGroupItem[];
  createdAt: Date;
}

export interface DeterministicProposalGroupingInput {
  daoId: string;
  proposals: ProposalRecord[];
  topics: TopicRecord[];
  groups: ProposalGroupRecord[];
  allowedCategoryIds: number[];
}

export interface DeterministicProposalGroupingResult {
  groups: ProposalGroupRecord[];
  unresolvedProposalIds: string[];
  urlMatchedProposalIds: string[];
}

function cloneGroup(group: ProposalGroupRecord): ProposalGroupRecord {
  return {
    ...group,
    items: group.items.map((item) => ({ ...item })),
  };
}

function ensureGroupName(group: ProposalGroupRecord): void {
  const firstItem = group.items[0];
  if (firstItem) {
    group.name = firstItem.name;
  }
}

function buildTopicMaps(groups: ProposalGroupRecord[]) {
  const topicKeyToGroup = new Map<string, ProposalGroupRecord>();
  const groupedProposalKeys = new Set<string>();

  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'topic') {
        const key = getTopicItemKey(item);
        if (!topicKeyToGroup.has(key)) {
          topicKeyToGroup.set(key, group);
        }
      } else {
        groupedProposalKeys.add(getProposalItemKey(item));
      }
    }
  }

  return { topicKeyToGroup, groupedProposalKeys };
}

function createTopicOnlyGroup(
  daoId: string,
  topic: TopicRecord
): ProposalGroupRecord {
  return {
    id: randomUUID(),
    daoId,
    name: topic.title,
    createdAt: topic.createdAt,
    items: [
      {
        type: 'topic',
        name: topic.title,
        externalId: String(topic.externalId),
        daoDiscourseId: topic.daoDiscourseId,
      },
    ],
  };
}

export function planDeterministicProposalGrouping(
  input: DeterministicProposalGroupingInput
): DeterministicProposalGroupingResult {
  const groups = input.groups.map(cloneGroup);
  const allowedCategoryIds = new Set(input.allowedCategoryIds);

  const topicsById = new Map<number, TopicRecord>();
  const topicsBySlug = new Map<string, TopicRecord>();
  for (const topic of input.topics) {
    topicsById.set(topic.externalId, topic);
    topicsBySlug.set(topic.slug, topic);
  }

  let { topicKeyToGroup } = buildTopicMaps(groups);

  for (const topic of input.topics) {
    if (!allowedCategoryIds.has(topic.categoryId)) {
      continue;
    }

    const topicKey = getTopicItemKey({
      externalId: String(topic.externalId),
      daoDiscourseId: topic.daoDiscourseId,
    });

    if (!topicKeyToGroup.has(topicKey)) {
      const group = createTopicOnlyGroup(input.daoId, topic);
      groups.push(group);
      topicKeyToGroup.set(topicKey, group);
    }
  }

  const rebuiltMaps = buildTopicMaps(groups);
  topicKeyToGroup = rebuiltMaps.topicKeyToGroup;
  const groupedProposalKeys = rebuiltMaps.groupedProposalKeys;

  const unresolvedProposalIds: string[] = [];
  const urlMatchedProposalIds: string[] = [];

  for (const proposal of input.proposals) {
    const proposalKey = getProposalItemKey({
      externalId: proposal.externalId,
      governorId: proposal.governorId,
    });

    if (groupedProposalKeys.has(proposalKey)) {
      continue;
    }

    const discussionUrl = proposal.discussionUrl?.trim();
    if (!discussionUrl) {
      unresolvedProposalIds.push(proposal.id);
      continue;
    }

    const extracted = extractDiscourseIdOrSlug(discussionUrl);
    const matchedTopic =
      (extracted.id !== null ? topicsById.get(extracted.id) : undefined) ??
      (extracted.slug ? topicsBySlug.get(extracted.slug) : undefined);

    if (!matchedTopic) {
      unresolvedProposalIds.push(proposal.id);
      continue;
    }

    const topicKey = getTopicItemKey({
      externalId: String(matchedTopic.externalId),
      daoDiscourseId: matchedTopic.daoDiscourseId,
    });

    let group = topicKeyToGroup.get(topicKey);
    if (!group) {
      group = createTopicOnlyGroup(input.daoId, matchedTopic);
      groups.push(group);
      topicKeyToGroup.set(topicKey, group);
    }

    group.items.push({
      type: 'proposal',
      name: proposal.name,
      externalId: proposal.externalId,
      governorId: proposal.governorId,
    });
    ensureGroupName(group);
    groupedProposalKeys.add(proposalKey);
    urlMatchedProposalIds.push(proposal.id);
  }

  return {
    groups,
    unresolvedProposalIds,
    urlMatchedProposalIds,
  };
}
