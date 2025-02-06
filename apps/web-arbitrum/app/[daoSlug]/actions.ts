import { otel } from '@/lib/otel';
import { AsyncReturnType } from '@/lib/utils';
import { db } from '@proposalsapp/db';
import { unstable_cache } from 'next/cache';

async function getGroups(daoSlug: string) {
  'use server';
  return otel('get-groups', async () => {
    // Fetch the DAO based on the slug
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) return null;

    // First, fetch all groups for the DAO
    const allGroups = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('daoId', '=', dao.id)
      .execute();

    // Function to find the newest item timestamp in a group
    const getNewestItemTimestamp = async (
      group: (typeof allGroups)[0]
    ): Promise<number> => {
      return otel('get-newest-item-timestamp', async () => {
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

        const [latestProposal, latestTopic] = await Promise.all([
          proposalIds.length > 0
            ? db
                .selectFrom('proposal')
                .select('createdAt')
                .where('id', 'in', proposalIds)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .executeTakeFirst()
            : Promise.resolve(null),
          topicIds.length > 0
            ? db
                .selectFrom('discourseTopic')
                .select('createdAt')
                .where('id', 'in', topicIds)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .executeTakeFirst()
            : Promise.resolve(null),
        ]);

        return Math.max(
          latestProposal?.createdAt
            ? new Date(latestProposal.createdAt).getTime()
            : 0,
          latestTopic?.createdAt ? new Date(latestTopic.createdAt).getTime() : 0
        );
      });
    };

    // Add timestamps to all groups
    const groupsWithTimestamps = await Promise.all(
      allGroups.map(async (group) => ({
        ...group,
        newestItemTimestamp: await getNewestItemTimestamp(group),
      }))
    );

    // Sort all groups by their items' timestamps
    groupsWithTimestamps.sort(
      (a, b) => b.newestItemTimestamp - a.newestItemTimestamp
    );

    return {
      daoName: dao.name,
      groups: groupsWithTimestamps,
    };
  });
}

export const getGroups_cached = unstable_cache(
  async (daoSlug: string) => {
    return await getGroups(daoSlug);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-groups'] }
);

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;

async function getGroupData(groupId: string): Promise<{
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
}> {
  'use server';
  return otel('get-group-data', async () => {
    const group = await db
      .selectFrom('proposalGroup')
      .where('id', '=', groupId)
      .selectAll()
      .executeTakeFirst();

    if (!group) {
      return {
        originalAuthorName: 'Unknown',
        originalAuthorPicture: '/fallback-avatar.png',
        groupName: 'Unknown Group',
      };
    }

    const items = group.items as Array<{
      id: string;
      type: 'proposal' | 'topic';
    }>;

    // Find the first topic in the group
    const firstTopic = items.find((item) => item.type === 'topic');

    if (!firstTopic) {
      return {
        originalAuthorName: 'Unknown',
        originalAuthorPicture: '/fallback-avatar.png',
        groupName: group.name,
      };
    }

    try {
      const discourseTopic = await db
        .selectFrom('discourseTopic')
        .where('id', '=', firstTopic.id)
        .selectAll()
        .executeTakeFirstOrThrow();

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

      return {
        originalAuthorName:
          discourseFirstPostAuthor.name?.trim() ||
          discourseFirstPostAuthor.username ||
          'Unknown',
        originalAuthorPicture: discourseFirstPostAuthor.avatarTemplate,
        groupName: group.name,
      };
    } catch (error) {
      console.error('Error fetching author data:', error);
      return {
        originalAuthorName: 'Unknown',
        originalAuthorPicture: '/fallback-avatar.png',
        groupName: group.name,
      };
    }
  });
}

export const getGroupData_cached = unstable_cache(
  async (groupId: string) => {
    return await getGroupData(groupId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-group-data'] }
);
