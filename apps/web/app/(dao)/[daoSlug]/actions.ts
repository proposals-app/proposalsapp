'use server';

import type { AsyncReturnType } from '@/lib/utils';
import { db, sql } from '@proposalsapp/db';
import { daoIdSchema, daoSlugSchema } from '@/lib/validations';
import { requireAuthAndDao } from '@/lib/server-actions-utils';
import { revalidateTag } from 'next/cache';
import { getFeed } from './(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';

export async function markAllAsRead(daoSlug: string) {
  try {
    const { userId, dao } = await requireAuthAndDao(daoSlug);

    // Fetch only the group IDs needed for the update
    const groupIds = await db.public
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
    const targetDb =
      daoSlug === 'arbitrum'
        ? db.arbitrum
        : daoSlug === 'uniswap'
          ? db.uniswap
          : null;

    if (!targetDb) {
      console.error(`[markAllAsRead] Invalid daoSlug: ${daoSlug}`);
      return;
    }

    await targetDb
      .insertInto('userProposalGroupLastRead')
      .values(values)
      .onConflict((oc) =>
        oc
          .columns(['userId', 'proposalGroupId'])
          .doUpdateSet({ lastReadAt: now })
      )
      .execute();

    revalidateTag(`groups-user-${userId}-${daoSlug}`);
  } catch (error) {
    console.error('[markAllAsRead] Error:', error);
    throw error;
  }
}

// Removed unused interfaces and helper functions since we now use the materialized view

/**
 * Fetches user-specific last read data for groups.
 */
async function getUserLastReadData(
  groupIds: string[],
  userId: string,
  daoSlug: string
): Promise<Map<string, Date | null>> {
  // 'use cache';
  // User-specific tag
  // cacheTag(`groups-user-${userId}-${daoSlug}`);
  // cacheLife('minutes'); // Shorter life for user-specific data

  const lastReadMap = new Map<string, Date | null>();
  if (groupIds.length === 0) return lastReadMap;

  const targetDb =
    daoSlug === 'arbitrum'
      ? db.arbitrum
      : daoSlug === 'uniswap'
        ? db.uniswap
        : null;

  if (!targetDb) {
    console.error(`[getUserLastReadData] Invalid daoSlug: ${daoSlug}`);
    return lastReadMap;
  }

  const lastReads = await targetDb
    .selectFrom('userProposalGroupLastRead')
    .where('userId', '=', userId)
    .where('proposalGroupId', 'in', groupIds)
    .select(['proposalGroupId', 'lastReadAt'])
    .execute();

  lastReads.forEach((lr) => {
    lastReadMap.set(lr.proposalGroupId, lr.lastReadAt);
  });

  return lastReadMap;
}

export async function getGroups(daoSlug: string, userId?: string) {
  daoSlugSchema.parse(daoSlug);

  const dao = await db.public
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select(['id', 'name'])
    .executeTakeFirst();

  if (!dao) return null;

  // Fetch data from materialized view
  const groupsData = await db.public
    .selectFrom('proposalGroupSummary')
    .where('daoId', '=', dao.id)
    .selectAll()
    .execute();

  if (!groupsData || groupsData.length === 0) return null;

  // Fetch User-Specific Last Read Data (Cached per user, shortest TTL)
  const groupIds = groupsData.map((g) => g.id);
  const lastReadMap = userId
    ? await getUserLastReadData(groupIds, userId, daoSlug)
    : new Map<string, Date | null>();

  // --- Combine Data and Sort ---
  const combinedGroups = groupsData.map((group) => {
    const lastReadAt = lastReadMap.get(group.id);
    const newestActivityTimestamp = group.latestActivityAt.getTime();
    const hasNewActivity = userId
      ? lastReadAt
        ? newestActivityTimestamp > lastReadAt.getTime()
        : true // New if never read
      : false; // No new activity if not logged in

    return {
      id: group.id,
      name: group.name,
      slug: `${group.id}`, // Assuming slug is just the ID for routing
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
      originalAuthorPicture: group.authorAvatarUrl,
      groupName: group.name,
    };
  });

  // --- Sorting ---
  combinedGroups.sort((a, b) => {
    if (a.hasActiveProposal && !b.hasActiveProposal) return -1;
    if (!a.hasActiveProposal && b.hasActiveProposal) return 1;
    if (a.hasActiveProposal && b.hasActiveProposal) {
      return a.earliestEndTime - b.earliestEndTime; // Active proposals sorted by earliest end time
    }
    // Inactive proposals sorted by newest activity
    return b.newestActivityTimestamp - a.newestActivityTimestamp;
  });

  return {
    daoName: dao.name,
    daoId: dao.id,
    groups: combinedGroups,
  };
}

/**
 * Fetches feed data for multiple groups in parallel
 * This eliminates the N+1 query problem when rendering active groups
 */
export async function getActiveGroupsFeeds(
  groupIds: string[]
): Promise<Map<string, FeedData | null>> {
  // 'use cache';
  // cacheTag(`active-feeds-${daoSlug}`);
  // cacheLife('minutes');

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

export async function getTotalVotingPower(daoId: string): Promise<number> {
  // 'use cache';
  // cacheLife('hours');
  // cacheTag(`total-vp-${daoId}`); // Add tag

  // Validate daoId
  try {
    daoIdSchema.parse(daoId);
  } catch {
    return 0;
  }

  try {
    const result = await db.public
      .with('latest_voting_power', (db) =>
        db
          .selectFrom('votingPower')
          .select(['voter', sql<string>`MAX(timestamp)`.as('latest_timestamp')])
          .where('daoId', '=', daoId)
          .where(
            'votingPower.voter',
            '!=',
            '0x00000000000000000000000000000000000A4B86' // Filter out Arbitrum Foundation Vesting Wallet
          )
          .groupBy('voter')
      )
      .selectFrom('votingPower as vp')
      .innerJoin(
        'latest_voting_power as lvp',
        (join) =>
          join
            .onRef('vp.voter', '=', 'lvp.voter')
            .on('vp.timestamp', '=', sql`lvp.latest_timestamp`) // Use direct column name
      )
      .where('vp.daoId', '=', daoId)
      .select(
        // Ensure the sum returns a number, defaulting to 0
        sql<number>`COALESCE(SUM(vp.voting_power), 0)`.as('totalVotingPower')
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
