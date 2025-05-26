'use server';

import { AsyncReturnType } from '@/lib/utils';
import { db, sql } from '@proposalsapp/db';
import { ProposalGroupItem } from '@/lib/types';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { daoIdSchema, daoSlugSchema } from '@/lib/validations';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';

export async function markAllAsRead(daoSlug: string) {
  daoSlugSchema.parse(daoSlug);

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  if (!userId) {
    console.warn('[markAllAsRead] User not authenticated.');
    return;
  }

  const dao = await db.public
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select('id')
    .executeTakeFirst();

  if (!dao) {
    console.error(`[markAllAsRead] DAO not found for slug: ${daoSlug}`);
    return;
  }

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
    userId: userId,
    proposalGroupId: group.id,
    lastReadAt: now,
  }));

  // Batch insert/update all groups at once
  await (daoSlug in db ? db[daoSlug as keyof typeof db] : db.public)
    .insertInto('userProposalGroupLastRead')
    .values(values)
    .onConflict((oc) =>
      oc.columns(['userId', 'proposalGroupId']).doUpdateSet({ lastReadAt: now })
    )
    .execute();

  revalidateTag(`groups-user-${userId}-${daoSlug}`);
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
  proposalsCount: number; // <-- Added
  topicsCount: number; // <-- Added
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
  'use cache';
  // Cache this data longer and tag it non-user-specifically
  cacheTag(`groups-data-${daoId}`);
  cacheLife('minutes');

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
    items: group.items as ProposalGroupItem[],
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
  'use cache';
  // Shorter cache life for activity data
  cacheTag(`groups-activity-${groups[0]?.daoId || 'unknown'}`); // Tag by daoId if possible
  cacheLife('minutes');

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

  const activityMap = new Map<string, GroupActivityData>();
  const authorMap = new Map<string, GroupAuthorInfo>();
  const now = Date.now();

  for (const group of groups) {
    let newestItemTimestamp = 0;
    let hasActiveProposal = false;
    let earliestEndTime = Infinity;
    let groupVotesCount = 0;
    let groupPostsCount = 0;
    let groupProposalsCount = 0;
    let groupTopicsCount = 0;
    let earliestItemCreatedAt = new Date(); // Initialize with a recent date

    const itemAuthors: {
      name: string;
      picture: string;
      createdAt: Date;
    }[] = [];

    for (const item of group.items) {
      let itemTimestamp = 0;
      let itemCreatedAt = new Date();

      if (item.type === 'proposal') {
        groupProposalsCount++;
        const proposal = proposalsMap.get(
          `${item.externalId}-${item.governorId}`
        );
        if (proposal) {
          itemTimestamp = proposal.createdAt.getTime();
          itemCreatedAt = proposal.createdAt;
          groupVotesCount += proposal.voteCount;
          const endTime = proposal.endAt.getTime();
          if (endTime > now) {
            hasActiveProposal = true;
            earliestEndTime = Math.min(earliestEndTime, endTime);
          }
          itemAuthors.push({
            name: proposal.author || 'Unknown',
            picture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
            createdAt: itemCreatedAt,
          });
        }
      } else if (item.type === 'topic') {
        groupTopicsCount++;
        const topic = topicsMap.get(
          `${item.externalId}-${item.daoDiscourseId}`
        );
        if (topic) {
          itemTimestamp = topic.bumpedAt.getTime();
          itemCreatedAt = topic.createdAt;
          groupPostsCount += topic.postsCount;

          const author = firstPostsAuthorsMap.get(
            `${topic.externalId}-${topic.daoDiscourseId}`
          );
          if (author) {
            itemAuthors.push({
              name: author.username || author.name || 'Unknown',
              picture: author.avatarTemplate.length
                ? author.avatarTemplate.replace(/{size}/g, '240') // Use a larger size
                : `https://api.dicebear.com/9.x/pixel-art/png?seed=${author.username}`,
              createdAt: itemCreatedAt,
            });
          }
        }
      }
      newestItemTimestamp = Math.max(newestItemTimestamp, itemTimestamp);
      if (itemCreatedAt < earliestItemCreatedAt) {
        earliestItemCreatedAt = itemCreatedAt;
      }
    }

    // Determine final author info
    itemAuthors.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const finalAuthor = itemAuthors[0] || {
      name: 'Unknown',
      picture: 'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
      createdAt: new Date(0),
    };

    activityMap.set(group.id, {
      id: group.id,
      newestActivityTimestamp: newestItemTimestamp,
      hasActiveProposal,
      earliestEndTime: hasActiveProposal ? earliestEndTime : Infinity,
      votesCount: groupVotesCount,
      postsCount: Math.max(0, groupPostsCount - groupTopicsCount),
      proposalsCount: groupProposalsCount,
      topicsCount: groupTopicsCount,
    });

    authorMap.set(group.id, {
      id: group.id,
      originalAuthorName: finalAuthor.name,
      originalAuthorPicture: finalAuthor.picture,
      earliestItemCreatedAt: finalAuthor.createdAt,
    });
  }

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
  'use cache';
  // User-specific tag
  cacheTag(`groups-user-${userId}-${daoSlug}`);
  cacheLife('minutes'); // Shorter life for user-specific data

  const lastReadMap = new Map<string, Date | null>();
  if (groupIds.length === 0) return lastReadMap;

  const lastReads = await (
    daoSlug in db ? db[daoSlug as keyof typeof db] : db.public
  )
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
      proposalsCount: activityData?.proposalsCount || 0, // <-- Added
      topicsCount: activityData?.topicsCount || 0, // <-- Added
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

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;

// --- Other Functions (getTokenPrice, getTotalVotingPower, getTreasuryBalance) ---
// These seem reasonably optimized and appropriately cached already.
// Keeping them as they are unless specific issues arise.

export async function getTotalVotingPower(daoId: string): Promise<number> {
  'use cache';
  cacheLife('hours');
  cacheTag(`total-vp-${daoId}`); // Add tag

  daoIdSchema.parse(daoId);

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
