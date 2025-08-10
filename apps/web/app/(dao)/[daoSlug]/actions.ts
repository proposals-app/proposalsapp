'use server';

import type { AsyncReturnType } from '@/lib/utils';
import { db, sql } from '@proposalsapp/db';
import { daoIdSchema, daoSlugSchema } from '@/lib/validations';
import { requireAuthAndDao } from '@/lib/server-actions-utils';
import { revalidateTag, unstable_cache } from 'next/cache';
import { getFeed } from './(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';

export async function markAllAsRead(daoSlug: string) {
  try {
    const { userId, dao } = await requireAuthAndDao(daoSlug);

    // Fetch only the group IDs needed for the update
    const groupIds = await db
      .selectFrom('proposalGroup')
      .where('daoId', '=', dao.id)
      .select('id')
      .execute();

    if (groupIds.length === 0) {
      console.log('[markAllAsRead] No groups found for DAO, nothing to mark.');
      return;
    }

    const now = new Date();
    const values = groupIds.map((group) => ({
      userId,
      proposalGroupId: group.id,
      lastReadAt: now,
    }));

    // Batch insert/update all groups at once
    await db
      .insertInto('userProposalGroupLastRead')
      .values(values)
      .onConflict((oc) =>
        oc
          .columns(['userId', 'proposalGroupId'])
          .doUpdateSet({ lastReadAt: now })
      )
      .execute();

    // Revalidate the groups cache
    revalidateTag('groups');
  } catch (error) {
    console.error('[markAllAsRead] Error:', error);
    throw error;
  }
}

// Internal function for fetching groups data (without user-specific data)
async function getGroupsDataInternal(daoSlug: string) {
  daoSlugSchema.parse(daoSlug);

  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select(['id', 'name'])
    .executeTakeFirst();

  if (!dao) return null;

  // Single optimized query using lateral joins for better performance
  const groupsWithStats = await db
    .selectFrom('proposalGroup as pg')
    .where('pg.daoId', '=', dao.id)
    .where('pg.name', '!=', 'UNGROUPED')
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('proposal as p')
          .leftJoin('vote as v', 'v.proposalId', 'p.id')
          .whereRef(
            sql`(p."external_id", p."governor_id")`,
            'in',
            sql`(
              SELECT
                (item->>'externalId')::text,
                (item->>'governorId')::uuid
              FROM jsonb_array_elements(pg.items) AS item
              WHERE item->>'type' = 'proposal'
            )`
          )
          .select([
            sql<number>`COUNT(DISTINCT p.id)`.as('proposalsCount'),
            sql<number>`COUNT(v.id)`.as('votesCount'),
            sql<Date | null>`MAX(p.created_at)`.as('latestProposalActivity'),
            sql<Date | null>`MIN(CASE WHEN p.end_at > NOW() THEN p.end_at END)`.as(
              'earliestEndTime'
            ),
            sql<boolean>`COUNT(CASE WHEN p.end_at > NOW() THEN 1 END) > 0`.as(
              'hasActiveProposal'
            ),
          ])
          .as('ps'),
      (join) => join.onTrue()
    )
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('discourseTopic as dt')
          .whereRef(
            sql`(dt."external_id", dt."dao_discourse_id")`,
            'in',
            sql`(
              SELECT
                (item->>'externalId')::int,
                (item->>'daoDiscourseId')::uuid
              FROM jsonb_array_elements(pg.items) AS item
              WHERE item->>'type' = 'topic'
            )`
          )
          .select([
            sql<number>`COUNT(dt.id)`.as('topicsCount'),
            sql<number>`SUM(dt.posts_count)`.as('postsCount'),
            sql<Date | null>`MAX(COALESCE(dt.bumped_at, dt.created_at))`.as(
              'latestTopicActivity'
            ),
          ])
          .as('ts'),
      (join) => join.onTrue()
    )
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom(
            sql<{
              author_name: string;
              author_picture: string;
              created_at: Date;
            }>`(
              SELECT
                p.author as author_name,
                'https://api.dicebear.com/9.x/pixel-art/png?seed=' || COALESCE(p.author, 'unknown') as author_picture,
                p.created_at
              FROM public.proposal p
              WHERE (p."external_id", p."governor_id") IN (
                SELECT
                  (item->>'externalId')::text,
                  (item->>'governorId')::uuid
                FROM jsonb_array_elements(pg.items) AS item
                WHERE item->>'type' = 'proposal'
              )
              UNION ALL
              SELECT
                du.username as author_name,
                du.avatar_template as author_picture,
                dt.created_at
              FROM public.discourse_topic dt
              JOIN public.discourse_post dp ON dp.topic_id = dt.external_id
                AND dp.dao_discourse_id = dt.dao_discourse_id
                AND dp.post_number = 1
              JOIN public.discourse_user du ON du.external_id = dp.user_id
                AND du.dao_discourse_id = dp.dao_discourse_id
              WHERE (dt."external_id", dt."dao_discourse_id") IN (
                SELECT
                  (item->>'externalId')::int,
                  (item->>'daoDiscourseId')::uuid
                FROM jsonb_array_elements(pg.items) AS item
                WHERE item->>'type' = 'topic'
              )
              ORDER BY created_at ASC
              LIMIT 1
            )`.as('earliest')
          )
          .select([
            sql<string>`COALESCE(earliest.author_name, 'Unknown')`.as(
              'authorName'
            ),
            sql<string>`COALESCE(
              earliest.author_picture,
              'https://api.dicebear.com/9.x/pixel-art/png?seed=' || COALESCE(earliest.author_name, 'Unknown')
            )`.as('authorPicture'),
          ])
          .as('author'),
      (join) => join.onTrue()
    )
    .select([
      'pg.id',
      'pg.name',
      'pg.daoId',
      'pg.createdAt',
      // Proposal stats with defaults
      sql<number>`COALESCE(ps.proposals_count, 0)`.as('proposalsCount'),
      sql<number>`COALESCE(ps.votes_count, 0)`.as('votesCount'),
      'ps.latestProposalActivity',
      'ps.earliestEndTime',
      sql<boolean>`COALESCE(ps.has_active_proposal, false)`.as(
        'hasActiveProposal'
      ),
      // Topic stats with defaults
      sql<number>`COALESCE(ts.topics_count, 0)`.as('topicsCount'),
      sql<number>`COALESCE(ts.posts_count, 0)`.as('postsCount'),
      'ts.latestTopicActivity',
      // Author info
      'author.authorName',
      'author.authorPicture',
    ])
    .execute();

  // Note: User-specific data is handled in the main getGroups function

  // Transform the results
  const groups = groupsWithStats.map((group) => {
    const latestProposalActivity = group.latestProposalActivity?.getTime() || 0;
    const latestTopicActivity = group.latestTopicActivity?.getTime() || 0;
    const newestActivityTimestamp = Math.max(
      latestProposalActivity,
      latestTopicActivity,
      group.createdAt.getTime()
    );

    // hasNewActivity will be set in the main function for user-specific data
    const hasNewActivity = false;

    return {
      id: group.id,
      name: group.name,
      slug: group.id,
      daoId: group.daoId,
      votesCount: Number(group.votesCount),
      postsCount: Number(group.postsCount),
      proposalsCount: Number(group.proposalsCount),
      topicsCount: Number(group.topicsCount),
      newestActivityTimestamp,
      hasNewActivity,
      hasActiveProposal: group.hasActiveProposal,
      earliestEndTime: group.earliestEndTime?.getTime() || Infinity,
      originalAuthorName: group.authorName,
      originalAuthorPicture: group.authorPicture,
      groupName: group.name,
    };
  });

  // Sort groups
  groups.sort((a, b) => {
    if (a.hasActiveProposal && !b.hasActiveProposal) return -1;
    if (!a.hasActiveProposal && b.hasActiveProposal) return 1;
    if (a.hasActiveProposal && b.hasActiveProposal) {
      return a.earliestEndTime - b.earliestEndTime;
    }
    return b.newestActivityTimestamp - a.newestActivityTimestamp;
  });

  return {
    daoName: dao.name,
    daoId: dao.id,
    groups,
  };
}

// Cached version of getGroupsData
const getCachedGroupsData = unstable_cache(
  getGroupsDataInternal,
  ['groups-data'],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: ['groups'],
  }
);

// Main export function that combines cached data with user-specific data
export async function getGroups(daoSlug: string, userId?: string) {
  // Get the cached groups data
  const cachedData = await getCachedGroupsData(daoSlug);

  if (!cachedData) return null;

  // If no userId, return cached data as-is
  if (!userId) {
    return cachedData;
  }

  // Apply user-specific last read data
  const lastReadMap = new Map<string, Date | null>();

  if (cachedData.groups.length > 0) {
    const groupIds = cachedData.groups.map((g) => g.id);
    const lastReads = await db
      .selectFrom('userProposalGroupLastRead')
      .where('userId', '=', userId)
      .where('proposalGroupId', 'in', groupIds)
      .select(['proposalGroupId', 'lastReadAt'])
      .execute();

    lastReads.forEach((lr) => {
      lastReadMap.set(lr.proposalGroupId, lr.lastReadAt);
    });
  }

  // Update groups with user-specific hasNewActivity
  const groupsWithUserData = cachedData.groups.map((group) => {
    const lastReadAt = lastReadMap.get(group.id);
    const hasNewActivity = lastReadAt
      ? group.newestActivityTimestamp > lastReadAt.getTime()
      : true;

    return {
      ...group,
      hasNewActivity,
    };
  });

  return {
    ...cachedData,
    groups: groupsWithUserData,
  };
}

/**
 * Fetches feed data for multiple groups in parallel
 * This eliminates the N+1 query problem when rendering active groups
 */
// Internal function for fetching active group feeds
async function getActiveGroupsFeedsInternal(
  groupIds: string[]
): Promise<Map<string, FeedData | null>> {
  if (!groupIds.length) return new Map();

  // Using static imports instead of dynamic imports

  // Fetch all feeds in parallel
  const feedPromises = groupIds.map(async (groupId) => {
    try {
      const feedData = await getFeed(
        groupId,
        FeedFilterEnum.VOTES,
        FromFilterEnum.ALL,
        true
      );
      return { groupId, feedData };
    } catch (error) {
      console.error(`Error fetching feed for group ${groupId}:`, error);
      return { groupId, feedData: null };
    }
  });

  const results = await Promise.all(feedPromises);

  // Convert to map for easy lookup
  return new Map(results.map(({ groupId, feedData }) => [groupId, feedData]));
}

// Cached version of getActiveGroupsFeeds
const getCachedActiveGroupsFeeds = unstable_cache(
  async (groupIds: string[]) => {
    const result = await getActiveGroupsFeedsInternal(groupIds);
    // Convert Map to array for serialization
    return Array.from(result.entries());
  },
  ['active-groups-feeds'],
  {
    revalidate: 30, // Cache for 30 seconds
    tags: ['feeds'],
  }
);

// Export function that handles the cached data
export async function getActiveGroupsFeeds(
  groupIds: string[]
): Promise<Map<string, FeedData | null>> {
  // Get cached data as array
  const cachedArray = await getCachedActiveGroupsFeeds(groupIds);
  // Convert back to Map
  return new Map(cachedArray);
}

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;
export type ActiveGroupsFeedsReturnType = AsyncReturnType<
  typeof getActiveGroupsFeeds
>;

// Type for individual feed data - will be imported from the main page actions
export type FeedData = Awaited<
  ReturnType<typeof import('./(main_page)/[groupId]/actions').getFeed>
>;

// --- Other Functions (getTokenPrice, getTotalVotingPower, getTreasuryBalance) ---
// These seem reasonably optimized and appropriately cached already.
// Keeping them as they are unless specific issues arise.

// Internal function for fetching total voting power
async function getTotalVotingPowerInternal(daoId: string): Promise<number> {
  // Validate daoId
  try {
    daoIdSchema.parse(daoId);
  } catch {
    return 0;
  }

  try {
    const result = await db
      .selectFrom('votingPowerLatest')
      .where('daoId', '=', daoId)
      .where(
        'voter',
        '!=',
        '0x00000000000000000000000000000000000A4B86' // Filter out Arbitrum Exclusion address
      )
      .select(
        // Ensure the sum returns a number, defaulting to 0
        sql<number>`COALESCE(SUM(voting_power), 0)`.as('totalVotingPower')
      )
      .executeTakeFirst();

    // result can be undefined if the query returns no rows
    return result?.totalVotingPower ?? 0;
  } catch (error) {
    console.error(
      `[getTotalVotingPower] Error fetching VP for DAO ${daoId}:`,
      error
    );
    return 0; // Return 0 on error
  }
}

// Cached version of getTotalVotingPower
const getCachedTotalVotingPower = unstable_cache(
  getTotalVotingPowerInternal,
  ['total-voting-power'],
  {
    revalidate: 1800, // Cache for 30 minutes
    tags: ['voting-power'],
  }
);

// Export function
export async function getTotalVotingPower(daoId: string): Promise<number> {
  return getCachedTotalVotingPower(daoId);
}
