'use server';

import { AsyncReturnType } from '@/lib/utils';
import { dbIndexer, sql } from '@proposalsapp/db-indexer';
import { ProposalGroupItem } from '@/lib/types';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { dbWeb } from '@proposalsapp/db-web';
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

  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select('id')
    .executeTakeFirst();

  if (!dao) {
    console.error(`[markAllAsRead] DAO not found for slug: ${daoSlug}`);
    return;
  }

  // Fetch only the group IDs needed for the update
  const groupIds = await dbIndexer
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
    user_id: userId,
    proposal_group_id: group.id,
    last_read_at: now,
  }));

  // Batch insert/update all groups at once
  await dbWeb
    .insertInto('user_proposal_group_last_read')
    .values(values)
    .onConflict((oc) =>
      oc
        .columns(['user_id', 'proposal_group_id'])
        .doUpdateSet({ last_read_at: now })
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

  const coreGroups = await dbIndexer
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
      ? dbIndexer
          .selectFrom('proposal')
          .leftJoin('vote', 'vote.proposalId', 'proposal.id')
          .select([
            'proposal.id',
            'proposal.externalId',
            'proposal.governorId',
            'proposal.author',
            'proposal.createdAt',
            'proposal.endAt',
            dbIndexer.fn.count('vote.id').as('voteCount'),
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
      ? dbIndexer
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
      ? dbIndexer
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

  const lastReads = await dbWeb
    .selectFrom('user_proposal_group_last_read')
    .where('user_id', '=', userId)
    .where('proposal_group_id', 'in', groupIds)
    .select(['proposal_group_id', 'last_read_at'])
    .execute();

  lastReads.forEach((lr) => {
    lastReadMap.set(lr.proposal_group_id, lr.last_read_at);
  });

  return lastReadMap;
}

export async function getGroups(daoSlug: string, userId?: string) {
  daoSlugSchema.parse(daoSlug);

  const dao = await dbIndexer
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

const ARBITRUM_COINGECKO_ID = 'arbitrum';

export const getTokenPrice = async (daoSlug: string) => {
  'use cache';
  cacheLife('hours');
  cacheTag(`token-price-${daoSlug}`); // Add tag

  daoSlugSchema.parse(daoSlug);

  if (daoSlug !== 'arbitrum') return null;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${ARBITRUM_COINGECKO_ID}/market_chart?vs_currency=usd&days=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // Revalidate hourly

    if (!res.ok) {
      console.error(
        `[getTokenPrice] Failed to fetch price data (${res.status} ${res.statusText}) for ${daoSlug} from ${url}`
      );
      return null;
    }

    const data = await res.json();
    if (data?.prices?.length > 0) {
      const latestPrice = data.prices[data.prices.length - 1][1];
      return latestPrice as number;
    }
    console.warn(`[getTokenPrice] No price data found for ${daoSlug}`);
    return null;
  } catch (error) {
    console.error(
      `[getTokenPrice] Error fetching token price for ${daoSlug}:`,
      error
    );
    return null;
  }
};

export async function getTotalVotingPower(daoId: string): Promise<number> {
  'use cache';
  cacheLife('hours');
  cacheTag(`total-vp-${daoId}`); // Add tag

  daoIdSchema.parse(daoId);

  try {
    const result = await dbIndexer
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

async function fetchBalanceForAddress(address: string): Promise<number> {
  interface TokenBalance {
    balance: string;
    decimals: number;
    quoteRate: number | null;
  }

  interface TallyResponse {
    data: {
      balances: TokenBalance[];
    };
  }

  const TALLY_API_KEY = process.env.TALLY_API_KEY;
  if (!TALLY_API_KEY) {
    console.warn(
      `[fetchBalanceForAddress] TALLY_API_KEY not set, cannot fetch balance for ${address}`
    );
    return 0;
  }

  try {
    const response = await fetch('https://api.tally.xyz/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': TALLY_API_KEY,
      },
      body: JSON.stringify({
        query: `
          query TokenBalances($input: AccountID!) {
            balances(accountID: $input) {
              decimals
              balance
              quoteRate
            }
          }
        `,
        variables: {
          input: address,
        },
      }),
      next: { revalidate: 86400 }, // Revalidate daily
    });

    if (!response.ok) {
      console.error(
        `[fetchBalanceForAddress] Failed to fetch balance for address ${address} (${response.status} ${response.statusText})`
      );
      return 0;
    }

    const data = (await response.json()) as TallyResponse;

    if (!data?.data?.balances) {
      console.warn(
        `[fetchBalanceForAddress] Invalid response structure for ${address}`
      );
      return 0;
    }

    return data.data.balances.reduce((total, token) => {
      if (token.quoteRate && token.balance && token.decimals != null) {
        // Add explicit checks for null/undefined if necessary
        const balance = Number(token.balance) / Math.pow(10, token.decimals);
        return total + balance * token.quoteRate;
      }
      return total;
    }, 0);
  } catch (error) {
    console.error(
      `[fetchBalanceForAddress] Error fetching balance for address ${address}:`,
      error
    );
    return 0;
  }
}

export const getTreasuryBalance = async (daoSlug: string) => {
  'use cache';
  cacheLife('days');
  cacheTag(`treasury-${daoSlug}`); // Add tag

  daoSlugSchema.parse(daoSlug);

  // Consider moving this mapping outside or making it configurable
  const TREASURY_ADDRESSES = [
    'eip155:42161:0x34d45e99f7D8c45ed05B5cA72D54bbD1fb3F98f0',
    'eip155:42161:0xbFc1FECa8B09A5c5D3EFfE7429eBE24b9c09EF58',
    'eip155:42161:0xF3FC178157fb3c87548bAA86F9d24BA38E649B58',
    'eip155:42161:0x2E041280627800801E90E9Ac83532fadb6cAd99A',
    'eip155:42161:0x32e7AF5A8151934F3787d0cD59EB6EDd0a736b1d',
    'eip155:42161:0xbF5041Fc07E1c866D15c749156657B8eEd0fb649',
    'eip155:42170:0x509386DbF5C0BE6fd68Df97A05fdB375136c32De',
    'eip155:42170:0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce',
    'eip155:42170:0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f',
    'eip155:42170:0xf7951d92b0c345144506576ec13ecf5103ac905a',
  ];

  if (daoSlug !== 'arbitrum') return null; // For now, only Arbitrum

  try {
    // Use Promise.allSettled to handle potential failures for individual addresses
    const results = await Promise.allSettled(
      TREASURY_ADDRESSES.map(fetchBalanceForAddress)
    );

    const totalBalance = results.reduce((sum, result) => {
      if (result.status === 'fulfilled') {
        return sum + result.value;
      } else {
        console.error(
          `[getTreasuryBalance] Failed to fetch balance for an address: ${result.reason}`
        );
        return sum; // Exclude failed fetches from the total
      }
    }, 0);

    return totalBalance;
  } catch (error) {
    console.error(
      `[getTreasuryBalance] Error calculating total treasury balance for ${daoSlug}:`,
      error
    );
    return null;
  }
};
