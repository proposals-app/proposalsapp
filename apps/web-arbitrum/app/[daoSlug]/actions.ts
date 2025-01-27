import { otel } from '@/lib/otel';
import { AsyncReturnType } from '@/lib/utils';
import { db } from '@proposalsapp/db';
import { unstable_cache } from 'next/cache';

export async function getGroups(
  daoSlug: string,
  page: number,
  itemsPerPage: number
) {
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
                .select('timeCreated')
                .where('id', 'in', proposalIds)
                .orderBy('timeCreated', 'desc')
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
          latestProposal?.timeCreated
            ? new Date(latestProposal.timeCreated).getTime()
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

    // Calculate the start and end indices for pagination
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Slice the sorted groups array to get the requested page
    const paginatedGroups = groupsWithTimestamps
      .slice(startIndex, endIndex)
      .map((group) => {
        const { ...rest } = group;
        return rest;
      });

    return {
      daoName: dao.name,
      groups: paginatedGroups,
    };
  });
}

export const getGroups_cached = unstable_cache(
  async (daoSlug: string, page: number, itemsPerPage: number) => {
    return await getGroups(daoSlug, page, itemsPerPage);
  },
  ['get-groups'],
  { revalidate: 60 * 5, tags: ['get-groups'] }
);

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;
