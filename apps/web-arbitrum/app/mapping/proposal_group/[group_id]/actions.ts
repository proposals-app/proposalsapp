'use server';

import { otel } from '@/lib/otel';
import { AsyncReturnType } from '@/lib/utils';
import {
  db,
  DiscoursePost,
  DiscourseTopic,
  IndexerVariant,
  JsonArray,
  JsonValue,
  Proposal,
  Selectable,
  Vote,
} from '@proposalsapp/db';

// Define a type for the items in the group
type GroupItem = {
  type: 'proposal' | 'topic';
  id: string;
};

// Helper function to check if an item is a valid GroupItem
function isGroupItem(item: JsonValue): item is GroupItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    'id' in item &&
    (item.type === 'proposal' || item.type === 'topic') &&
    typeof item.id === 'string'
  );
}

export type TopicWithPosts = Selectable<DiscourseTopic> & {
  daoDiscourseId: string;
  discourseBaseUrl: string | null;
  enabled: boolean | null;
  posts: Selectable<DiscoursePost>[];
};

export async function getGroupDetails(groupId: string) {
  return otel('get-group-details', async () => {
    const group = await db
      .selectFrom('proposalGroup')
      .where('id', '=', groupId)
      .selectAll()
      .executeTakeFirst();

    if (!group) {
      return null;
    }

    const items = group.items as JsonArray;

    // Filter and map proposal IDs
    const proposalIds = items
      .filter(isGroupItem)
      .filter(
        (item): item is { type: 'proposal'; id: string } =>
          item.type === 'proposal'
      )
      .map((item) => item.id);

    // Filter and map topic IDs
    const topicIds = items
      .filter(isGroupItem)
      .filter(
        (item): item is { type: 'topic'; id: string } => item.type === 'topic'
      )
      .map((item) => item.id);

    const proposals: (Selectable<Proposal> & {
      votes: Selectable<Vote>[];
      indexerVariant: IndexerVariant | null;
    })[] =
      proposalIds.length > 0
        ? await db
            .selectFrom('proposal')
            .where('proposal.id', 'in', proposalIds)
            .leftJoin('vote', 'vote.proposalId', 'proposal.id')
            .leftJoin('daoIndexer', 'daoIndexer.id', 'proposal.daoIndexerId')
            .selectAll('proposal')
            .select('daoIndexer.indexerVariant')
            .select(db.fn.jsonAgg('vote').as('votes'))
            .groupBy(['proposal.id', 'daoIndexer.indexerVariant'])
            .execute()
        : [];

    const topics: TopicWithPosts[] =
      topicIds.length > 0
        ? await db
            .selectFrom('discourseTopic')
            .where('discourseTopic.id', 'in', topicIds)
            .leftJoin(
              'daoDiscourse',
              'discourseTopic.daoDiscourseId',
              'daoDiscourse.id'
            )
            .leftJoin(
              'discoursePost',
              'discoursePost.topicId',
              'discourseTopic.externalId'
            )
            .selectAll('discourseTopic')
            .select(['daoDiscourse.discourseBaseUrl', 'daoDiscourse.enabled'])
            .select(db.fn.jsonAgg('discoursePost').as('posts'))
            .groupBy([
              'discourseTopic.id',
              'daoDiscourse.id',
              'daoDiscourse.discourseBaseUrl',
              'daoDiscourse.enabled',
            ])
            .execute()
        : [];

    return {
      ...group,
      proposals,
      topics,
    };
  });
}

export type GroupDetailsType = AsyncReturnType<typeof getGroupDetails>;
