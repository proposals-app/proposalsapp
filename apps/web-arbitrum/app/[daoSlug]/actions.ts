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

    let authorInfo = {
      originalAuthorName: 'Unknown',
      originalAuthorPicture: '/fallback-avatar.png',
    };

    // Helper function to fetch topic and its author info
    const getTopicAuthorInfo = async (topicId: string) => {
      try {
        const discourseTopic = await db
          .selectFrom('discourseTopic')
          .where('id', '=', topicId)
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
          createdAt: discourseTopic.createdAt, // Include createdAt for sorting
        };
      } catch (topicError) {
        console.error('Error fetching topic author data:', topicError);
        return null;
      }
    };

    // Helper function to fetch proposal and its author info
    const getProposalAuthorInfo = async (proposalId: string) => {
      try {
        const proposal = await db
          .selectFrom('proposal')
          .where('id', '=', proposalId)
          .selectAll()
          .executeTakeFirstOrThrow();

        return {
          originalAuthorName: proposal.author || 'Unknown', // Replace 'author' with the correct field
          originalAuthorPicture: '/fallback-avatar.png', // No avatar available from proposal, using fallback
          createdAt: proposal.createdAt, // Include createdAt for sorting
        };
      } catch (proposalError) {
        console.error('Error fetching proposal author data:', proposalError);
        return null;
      }
    };

    // Fetch all topics with their author info
    const topicsWithAuthors = await Promise.all(
      items
        .filter((item) => item.type === 'topic')
        .map((topic) => getTopicAuthorInfo(topic.id))
    );

    // Fetch all proposals with their author info
    const proposalsWithAuthors = await Promise.all(
      items
        .filter((item) => item.type === 'proposal')
        .map((proposal) => getProposalAuthorInfo(proposal.id))
    );

    // Combine topics and proposals, filter out null results, and sort by createdAt
    const allItemsWithAuthors = [...topicsWithAuthors, ...proposalsWithAuthors]
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    // If there are any items with authors, use the first one
    if (allItemsWithAuthors.length > 0) {
      authorInfo = {
        originalAuthorName: allItemsWithAuthors[0].originalAuthorName,
        originalAuthorPicture: allItemsWithAuthors[0].originalAuthorPicture,
      };
    }

    return {
      ...authorInfo,
      groupName: group.name,
    };
  });
}

export const getGroupData_cached = unstable_cache(
  async (groupId: string) => {
    return await getGroupData(groupId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-group-data'] }
);
