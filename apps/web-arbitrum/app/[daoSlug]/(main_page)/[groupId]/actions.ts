import { otel } from '@/lib/otel';
import { AsyncReturnType } from '@/lib/utils';
import {
  db,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
} from '@proposalsapp/db';
import { unstable_cache } from 'next/cache';
import { validate } from 'uuid';

async function getGroup(daoSlug: string, groupId: string) {
  'use server';
  return otel('get-group', async () => {
    if (daoSlug == 'favicon.ico') return null;

    // Fetch the DAO based on the slug
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) {
      return null;
    }

    let group: Selectable<ProposalGroup> | null = null;

    // Check if proposalOrGroupId is a UUIDv4
    if (validate(groupId)) {
      try {
        // Fetch the group based on ID
        group =
          (await db
            .selectFrom('proposalGroup')
            .where('id', '=', groupId)
            .selectAll()
            .executeTakeFirst()) ?? null;
      } catch (error) {
        console.error('Error fetching group:', error);
      }
    }

    if (group) {
      const items = group.items as Array<{
        id: string;
        type: 'proposal' | 'topic';
      }>;

      const proposalIds = items
        .filter((item) => item.type === 'proposal')
        .map((item) => item.id);

      const topicIds = items
        .filter((item) => item.type === 'topic')
        .map((item) => item.id);

      let proposals: Selectable<Proposal>[] = [];
      if (proposalIds.length > 0) {
        try {
          proposals = await db
            .selectFrom('proposal')
            .selectAll()
            .where('proposal.id', 'in', proposalIds)
            .execute();
        } catch (error) {
          console.error('Error fetching proposals:', error);
        }
      }

      let topics: Selectable<DiscourseTopic>[] = [];
      if (topicIds.length > 0) {
        try {
          topics = await db
            .selectFrom('discourseTopic')
            .where('discourseTopic.id', 'in', topicIds)
            .selectAll()
            .execute();
        } catch (error) {
          console.error('Error fetching topics:', error);
        }
      }

      return {
        dao,
        group,
        proposals,
        topics,
        daoSlug,
        groupId,
      };
    }
  });
}

export type Body = {
  title: string;
  content: string;
  author_name: string;
  author_picture: string;
  createdAt: Date;
  type: 'proposal' | 'topic';
};

async function getBodies(groupID: string) {
  'use server';
  return otel('get-bodies-', async () => {
    const bodies: Body[] = [];

    const group = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('id', '=', groupID)
      .executeTakeFirstOrThrow();

    if (!group) {
      return null;
    }

    const items = group.items as Array<{
      id: string;
      type: 'proposal' | 'topic';
    }>;

    const proposalIds = items
      .filter((item) => item.type === 'proposal')
      .map((item) => item.id);

    const topicIds = items
      .filter((item) => item.type === 'topic')
      .map((item) => item.id);

    let proposals: Selectable<Proposal>[] = [];
    if (proposalIds.length > 0) {
      try {
        proposals = await db
          .selectFrom('proposal')
          .selectAll()
          .where('proposal.id', 'in', proposalIds)
          .execute();
      } catch (error) {
        console.error('Error fetching proposals:', error);
      }
    }

    proposals.map((proposal) =>
      bodies.push({
        title: proposal.name,
        content: proposal.body,
        author_name: proposal.author ?? 'Unknown',
        author_picture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
        createdAt: proposal.createdAt,
        type: 'proposal',
      })
    );

    let discourseTopics: Selectable<DiscourseTopic>[] = [];
    if (topicIds.length > 0) {
      try {
        discourseTopics = await db
          .selectFrom('discourseTopic')
          .selectAll()
          .where('discourseTopic.id', 'in', topicIds)
          .execute();
      } catch (error) {
        console.error('Error fetching topics:', error);
      }
    }

    for (const discourseTopic of discourseTopics) {
      const discourseFirstPost = await db
        .selectFrom('discoursePost')
        .where('discoursePost.topicId', '=', discourseTopic.externalId)
        .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
        .where('discoursePost.postNumber', '=', 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostAuthor = await db
        .selectFrom('discourseUser')
        .where('discourseUser.externalId', '=', discourseFirstPost.userId)
        .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostRevisions = await db
        .selectFrom('discoursePostRevision')
        .where(
          'discoursePostRevision.discoursePostId',
          '=',
          discourseFirstPost.id
        )
        .selectAll()
        .execute();

      // If there are no revisions, use the post itself
      if (!discourseFirstPostRevisions.length)
        bodies.push({
          title: discourseTopic.title,
          content: discourseFirstPost.cooked ?? 'Unknown',
          author_name:
            discourseFirstPostAuthor.name?.trim() ||
            discourseFirstPostAuthor.username ||
            'Unknown',
          author_picture: discourseFirstPostAuthor.avatarTemplate,
          createdAt: discourseFirstPost.createdAt,
          type: 'topic',
        });

      for (const discourseFirstPostRevision of discourseFirstPostRevisions) {
        // If there are revisions, the initial post is in fact the before of version 2
        if (discourseFirstPostRevision.version == 2)
          bodies.push({
            title:
              discourseFirstPostRevision.cookedTitleBefore ??
              discourseTopic.title,
            content:
              discourseFirstPostRevision.cookedBodyBefore ??
              discourseFirstPost.cooked ??
              'Unknown',
            author_name:
              discourseFirstPostAuthor.name?.trim() ||
              discourseFirstPostAuthor.username ||
              'Unknown',
            author_picture: discourseFirstPostAuthor.avatarTemplate,
            createdAt: discourseFirstPost.createdAt,
            type: 'topic',
          });

        bodies.push({
          title:
            discourseFirstPostRevision.cookedTitleAfter ?? discourseTopic.title,
          content:
            discourseFirstPostRevision.cookedBodyAfter ??
            discourseFirstPost.cooked ??
            'Unknown',
          author_name:
            discourseFirstPostAuthor.name?.trim() ||
            discourseFirstPostAuthor.username ||
            'Unknown',
          author_picture: discourseFirstPostAuthor.avatarTemplate,
          createdAt: discourseFirstPostRevision.createdAt,
          type: 'topic',
        });
      }
    }

    bodies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return bodies;
  });
}

async function getTotalVersions(groupID: string) {
  'use server';
  return otel('get-total-versions', async () => {
    let totalVersions = 0;

    const group = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('id', '=', groupID)
      .executeTakeFirst();

    if (!group) {
      return null;
    }

    const items = group.items as Array<{
      id: string;
      type: 'proposal' | 'topic';
    }>;

    const proposalIds = items
      .filter((item) => item.type === 'proposal')
      .map((item) => item.id);

    const topicIds = items
      .filter((item) => item.type === 'topic')
      .map((item) => item.id);

    let proposals: Selectable<Proposal>[] = [];
    if (proposalIds.length > 0) {
      try {
        proposals = await db
          .selectFrom('proposal')
          .selectAll()
          .where('proposal.id', 'in', proposalIds)
          .execute();
      } catch (error) {
        console.error('Error fetching proposals:', error);
      }
    }

    totalVersions += proposals.length;

    let discourseTopics: Selectable<DiscourseTopic>[] = [];
    if (topicIds.length > 0) {
      try {
        discourseTopics = await db
          .selectFrom('discourseTopic')
          .selectAll()
          .where('discourseTopic.id', 'in', topicIds)
          .execute();
      } catch (error) {
        console.error('Error fetching topics:', error);
      }
    }

    for (const discourseTopic of discourseTopics) {
      const discourseFirstPost = await db
        .selectFrom('discoursePost')
        .where('discoursePost.topicId', '=', discourseTopic.externalId)
        .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
        .where('discoursePost.postNumber', '=', 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      totalVersions++;

      const discourseFirstPostRevisions = await db
        .selectFrom('discoursePostRevision')
        .where(
          'discoursePostRevision.discoursePostId',
          '=',
          discourseFirstPost.id
        )
        .selectAll()
        .execute();

      totalVersions += discourseFirstPostRevisions.length;
    }

    return totalVersions;
  });
}

export const getGroup_cached = unstable_cache(
  async (daoSlug: string, groupId: string) => {
    return await getGroup(daoSlug, groupId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-group'] }
);

export const getBodies_cached = unstable_cache(
  async (groupId: string) => {
    return await getBodies(groupId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-bodies'] }
);

export const getTotalVersions_cached = unstable_cache(
  async (groupId: string) => {
    return await getTotalVersions(groupId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-total-versions'] }
);

export type GroupReturnType = AsyncReturnType<typeof getGroup>;
export type BodiesReturnType = AsyncReturnType<typeof getBodies>;
