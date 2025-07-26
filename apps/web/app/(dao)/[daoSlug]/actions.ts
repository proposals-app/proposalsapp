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

interface ProposalGroupItem {
  type: 'proposal' | 'topic';
  externalId: string;
  governorId: string;
  daoDiscourseId: string;
}

interface GroupCoreData {
  id: string;
  name: string;
  items: ProposalGroupItem[];
  daoId: string;
}

interface GroupActivityData {
  id: string; // Group ID
  newestActivityTimestamp: number;
  hasActiveProposal: boolean;
  earliestEndTime: number;
  votesCount: number;
  postsCount: number;
  proposalsCount: number;
  topicsCount: number;
}

interface GroupAuthorInfo {
  id: string; // Group ID
  originalAuthorName: string;
  originalAuthorPicture: string;
  earliestItemCreatedAt: Date;
}

/**
 * Fetches core group data (ID, name, items). This can be cached more broadly.
 */
async function getCoreGroupsData(
  daoId: string
): Promise<GroupCoreData[] | null> {
  // 'use cache';
  // Cache this data longer and tag it non-user-specifically
  // cacheTag(`groups-data-${daoId}`);
  // cacheLife('minutes');

  const coreGroups = await db.public
    .selectFrom('proposalGroup')
    .select(['id', 'name', 'items', 'daoId'])
    .where('daoId', '=', daoId)
    .where('name', '!=', 'UNGROUPED')
    .execute();

  if (!coreGroups) return null;

  // Ensure items is parsed correctly
  return coreGroups.map((group) => ({
    ...group,
    items: group.items as unknown as ProposalGroupItem[],
  }));
}

/**
 * Fetches activity and author-related data for groups based on their items.
 * This involves more lookups and might change more often.
 */
async function getActivityAndAuthorData(groups: GroupCoreData[]): Promise<{
  activityMap: Map<string, GroupActivityData>;
  authorMap: Map<string, GroupAuthorInfo>;
}> {
  // 'use cache';
  // Shorter cache life for activity data
  // cacheTag(`groups-activity-${groups[0]?.daoId || 'unknown'}`); // Tag by daoId if possible
  // cacheLife('minutes');

  if (!groups || groups.length === 0) {
    return { activityMap: new Map(), authorMap: new Map() };
  }

  const allProposalItems: { externalId: string; governorId: string }[] = [];
  const allTopicItems: { externalId: string; daoDiscourseId: string }[] = [];
  const allTopicIdsForPosts: {
    topicExternalId: number;
    daoDiscourseId: string;
  }[] = [];

  groups.forEach((group) => {
    group.items.forEach((item) => {
      if (item.type === 'proposal') {
        allProposalItems.push({
          externalId: item.externalId,
          governorId: item.governorId,
        });
      } else if (item.type === 'topic') {
        allTopicItems.push({
          externalId: item.externalId,
          daoDiscourseId: item.daoDiscourseId,
        });
        allTopicIdsForPosts.push({
          topicExternalId: parseInt(item.externalId, 10),
          daoDiscourseId: item.daoDiscourseId,
        });
      }
    });
  });

  // --- Optimized Bulk Queries ---
  const proposalsPromise =
    allProposalItems.length > 0
      ? db.public
          .selectFrom('proposal')
          .leftJoin('vote', 'vote.proposalId', 'proposal.id')
          .select([
            'proposal.id',
            'proposal.externalId',
            'proposal.governorId',
            'proposal.author',
            'proposal.createdAt',
            'proposal.endAt',
            db.public.fn.count('vote.id').as('voteCount'),
          ])
          .where(
            sql`(proposal."external_id", proposal."governor_id")`,
            'in',
            sql`(${sql.join(
              allProposalItems.map(
                (item) => sql`(${item.externalId}, ${item.governorId})`
              )
            )})`
          )
          .groupBy(['proposal.id'])
          .execute()
      : Promise.resolve([]);

  const topicsPromise =
    allTopicItems.length > 0
      ? db.public
          .selectFrom('discourseTopic')
          .select([
            'discourseTopic.id as topicId', // Select the internal topic ID too
            'discourseTopic.externalId',
            'discourseTopic.daoDiscourseId',
            'discourseTopic.bumpedAt',
            'discourseTopic.postsCount',
            'discourseTopic.createdAt',
          ])
          .where((eb) =>
            eb.or(
              allTopicItems.map((item) =>
                eb('externalId', '=', parseInt(item.externalId, 10)).and(
                  'daoDiscourseId',
                  '=',
                  item.daoDiscourseId
                )
              )
            )
          )
          .execute()
      : Promise.resolve([]);

  // Fetch first post authors more efficiently
  const firstPostsAuthorsPromise =
    allTopicIdsForPosts.length > 0
      ? db.public
          .selectFrom('discoursePost as dp')
          .innerJoin('discourseUser as du', (join) =>
            join
              .onRef('du.externalId', '=', 'dp.userId')
              .onRef('du.daoDiscourseId', '=', 'dp.daoDiscourseId')
          )
          .select([
            'dp.topicId',
            'dp.daoDiscourseId',
            'du.username',
            'du.name',
            'du.avatarTemplate',
          ])
          .where('dp.postNumber', '=', 1)
          .where((eb) =>
            eb.or(
              allTopicIdsForPosts.map((item) =>
                eb('dp.topicId', '=', item.topicExternalId).and(
                  'dp.daoDiscourseId',
                  '=',
                  item.daoDiscourseId
                )
              )
            )
          )
          .execute()
      : Promise.resolve([]);

  const [proposals, topics, firstPostsAuthors] = await Promise.all([
    proposalsPromise,
    topicsPromise,
    firstPostsAuthorsPromise,
  ]);

  // --- Maps for Efficient Lookups ---
  const proposalsMap = new Map(
    proposals.map((p) => [
      `${p.externalId}-${p.governorId}`,
      { ...p, voteCount: Number(p.voteCount) },
    ])
  );
  const topicsMap = new Map(
    topics.map((t) => [`${t.externalId}-${t.daoDiscourseId}`, t])
  );
  const firstPostsAuthorsMap = new Map(
    firstPostsAuthors.map((p) => [
      `${p.topicId}-${p.daoDiscourseId}`,
      {
        username: p.username,
        name: p.name,
        avatarTemplate: p.avatarTemplate,
      },
    ])
  );

  // --- Process Each Group ---
  const activityMap = new Map<string, GroupActivityData>();
  const authorMap = new Map<string, GroupAuthorInfo>();

  groups.forEach((group) => {
    let newestActivityTimestamp = 0;
    let hasActiveProposal = false;
    let earliestEndTime = Infinity;
    let votesCount = 0;
    let postsCount = 0;
    let proposalsCount = 0;
    let topicsCount = 0;

    let earliestAuthorName = 'Unknown';
    let earliestAuthorPicture =
      'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app';
    let earliestItemCreatedAt = new Date();

    group.items.forEach((item) => {
      if (item.type === 'proposal') {
        const key = `${item.externalId}-${item.governorId}`;
        const proposal = proposalsMap.get(key);
        if (proposal) {
          proposalsCount++;
          newestActivityTimestamp = Math.max(
            newestActivityTimestamp,
            proposal.createdAt.getTime()
          );
          votesCount += proposal.voteCount;

          const now = Date.now();
          if (
            proposal.endAt.getTime() > now &&
            proposal.endAt.getTime() < earliestEndTime
          ) {
            hasActiveProposal = true;
            earliestEndTime = proposal.endAt.getTime();
          }

          if (proposal.createdAt < earliestItemCreatedAt) {
            earliestItemCreatedAt = proposal.createdAt;
            earliestAuthorName = proposal.author || 'Unknown';
            earliestAuthorPicture = `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author || 'unknown'}`;
          }
        }
      } else if (item.type === 'topic') {
        const key = `${item.externalId}-${item.daoDiscourseId}`;
        const topic = topicsMap.get(key);
        if (topic) {
          topicsCount++;
          const topicActivity = topic.bumpedAt
            ? topic.bumpedAt.getTime()
            : topic.createdAt.getTime();
          newestActivityTimestamp = Math.max(
            newestActivityTimestamp,
            topicActivity
          );
          postsCount += topic.postsCount;

          if (topic.createdAt < earliestItemCreatedAt) {
            earliestItemCreatedAt = topic.createdAt;
            const authorData = firstPostsAuthorsMap.get(
              `${topic.externalId}-${topic.daoDiscourseId}`
            );
            if (authorData) {
              earliestAuthorName = authorData.username;
              earliestAuthorPicture =
                authorData.avatarTemplate ||
                `https://api.dicebear.com/9.x/pixel-art/png?seed=${authorData.username}`;
            }
          }
        }
      }
    });

    activityMap.set(group.id, {
      id: group.id,
      newestActivityTimestamp,
      hasActiveProposal,
      earliestEndTime,
      votesCount,
      postsCount,
      proposalsCount,
      topicsCount,
    });

    authorMap.set(group.id, {
      id: group.id,
      originalAuthorName: earliestAuthorName,
      originalAuthorPicture: earliestAuthorPicture,
      earliestItemCreatedAt,
    });
  });

  return { activityMap, authorMap };
}

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

  // 1. Fetch Core Group Data (Cached separately)
  const coreGroups = await getCoreGroupsData(dao.id);
  if (!coreGroups) return null;

  // 2. Fetch Activity and Author Data (Cached separately, shorter TTL)
  const { activityMap, authorMap } = await getActivityAndAuthorData(coreGroups);

  // 3. Fetch User-Specific Last Read Data (Cached per user, shortest TTL)
  const groupIds = coreGroups.map((g) => g.id);
  const lastReadMap = userId
    ? await getUserLastReadData(groupIds, userId, daoSlug)
    : new Map<string, Date | null>();

  // --- Combine Data and Sort ---
  const combinedGroups = coreGroups.map((group) => {
    const activityData = activityMap.get(group.id);
    const authorData = authorMap.get(group.id);
    const lastReadAt = lastReadMap.get(group.id);

    const newestActivityTimestamp = activityData?.newestActivityTimestamp || 0;
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
      votesCount: activityData?.votesCount || 0,
      postsCount: activityData?.postsCount || 0,
      proposalsCount: activityData?.proposalsCount || 0,
      topicsCount: activityData?.topicsCount || 0,
      newestActivityTimestamp,
      hasNewActivity,
      hasActiveProposal: activityData?.hasActiveProposal || false,
      earliestEndTime: activityData?.earliestEndTime || Infinity,
      originalAuthorName: authorData?.originalAuthorName || 'Unknown',
      originalAuthorPicture:
        authorData?.originalAuthorPicture ||
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
      groupName: group.name,
      // Items are no longer needed here
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
