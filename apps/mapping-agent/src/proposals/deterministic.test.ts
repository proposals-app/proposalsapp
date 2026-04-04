import { describe, expect, it } from 'vitest';
import {
  planDeterministicProposalGrouping,
  type ProposalGroupRecord,
  type ProposalRecord,
  type TopicRecord,
} from './deterministic';

function makeTopic(
  overrides: Partial<TopicRecord> & Pick<TopicRecord, 'id' | 'externalId'>
): TopicRecord {
  return {
    id: overrides.id,
    externalId: overrides.externalId,
    daoDiscourseId: overrides.daoDiscourseId ?? 'dao-discourse-1',
    title: overrides.title ?? `Topic ${overrides.externalId}`,
    slug: overrides.slug ?? `topic-${overrides.externalId}`,
    categoryId: overrides.categoryId ?? 1,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeProposal(
  overrides: Partial<ProposalRecord> &
    Pick<ProposalRecord, 'id' | 'externalId' | 'governorId'>
): ProposalRecord {
  return {
    id: overrides.id,
    externalId: overrides.externalId,
    governorId: overrides.governorId,
    name: overrides.name ?? `Proposal ${overrides.externalId}`,
    discussionUrl: overrides.discussionUrl ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-02T00:00:00.000Z'),
  };
}

function makeGroup(
  overrides: Partial<ProposalGroupRecord>
): ProposalGroupRecord {
  return {
    id: overrides.id ?? 'group-1',
    daoId: overrides.daoId ?? 'dao-1',
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    name: overrides.name ?? 'Existing group',
    items: overrides.items ?? [],
  };
}

describe('planDeterministicProposalGrouping', () => {
  it('creates new groups only for allowed proposal discussion categories', () => {
    const allowedTopic = makeTopic({
      id: 'topic-1',
      externalId: 101,
      categoryId: 7,
    });
    const outOfCategoryTopic = makeTopic({
      id: 'topic-2',
      externalId: 202,
      categoryId: 99,
    });

    const result = planDeterministicProposalGrouping({
      daoId: 'dao-1',
      proposals: [],
      topics: [allowedTopic, outOfCategoryTopic],
      groups: [],
      allowedCategoryIds: [7],
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.items).toEqual([
      {
        type: 'topic',
        name: allowedTopic.title,
        externalId: String(allowedTopic.externalId),
        daoDiscourseId: allowedTopic.daoDiscourseId,
      },
    ]);
  });

  it('creates an on-demand group for an out-of-category topic when a proposal URL points to it', () => {
    const urlMatchedTopic = makeTopic({
      id: 'topic-2',
      externalId: 202,
      categoryId: 99,
      title: 'Out of category topic',
      slug: 'out-of-category-topic',
    });
    const proposal = makeProposal({
      id: 'proposal-1',
      externalId: 'external-proposal-1',
      governorId: 'governor-1',
      name: 'Link proposal to topic',
      discussionUrl:
        'https://forum.example.com/t/out-of-category-topic/202?u=andrei',
    });

    const result = planDeterministicProposalGrouping({
      daoId: 'dao-1',
      proposals: [proposal],
      topics: [urlMatchedTopic],
      groups: [],
      allowedCategoryIds: [7],
    });

    expect(result.urlMatchedProposalIds).toEqual([proposal.id]);
    expect(result.unresolvedProposalIds).toEqual([]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.items).toEqual([
      {
        type: 'topic',
        name: urlMatchedTopic.title,
        externalId: String(urlMatchedTopic.externalId),
        daoDiscourseId: urlMatchedTopic.daoDiscourseId,
      },
      {
        type: 'proposal',
        name: proposal.name,
        externalId: proposal.externalId,
        governorId: proposal.governorId,
      },
    ]);
  });

  it('attaches URL-matched proposals to an existing topic group without creating a duplicate group', () => {
    const topic = makeTopic({ id: 'topic-1', externalId: 101, categoryId: 7 });
    const existingGroup = makeGroup({
      id: 'group-1',
      items: [
        {
          type: 'topic',
          name: topic.title,
          externalId: String(topic.externalId),
          daoDiscourseId: topic.daoDiscourseId,
        },
      ],
    });
    const proposal = makeProposal({
      id: 'proposal-1',
      externalId: 'external-proposal-1',
      governorId: 'governor-1',
      discussionUrl: `https://forum.example.com/t/${topic.slug}/${topic.externalId}`,
    });

    const result = planDeterministicProposalGrouping({
      daoId: 'dao-1',
      proposals: [proposal],
      topics: [topic],
      groups: [existingGroup],
      allowedCategoryIds: [7],
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.id).toBe(existingGroup.id);
    expect(result.groups[0]?.items).toHaveLength(2);
    expect(result.groups[0]?.items[1]).toEqual({
      type: 'proposal',
      name: proposal.name,
      externalId: proposal.externalId,
      governorId: proposal.governorId,
    });
  });
});
