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

export async function markAllAsRead(daoSlug: string) {
  daoSlugSchema.parse(daoSlug);

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  if (!userId) {
    return;
  }

  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select('id')
    .executeTakeFirst();

  if (!dao) {
    return;
  }

  const allGroups = await dbIndexer
    .selectFrom('proposalGroup')
    .where('daoId', '=', dao.id)
    .select('id')
    .execute();

  const now = new Date();
  const values = allGroups.map((group) => ({
    userId: userId,
    proposalGroupId: group.id,
    lastReadAt: now,
  }));

  // Batch insert/update all groups at once
  await dbWeb
    .insertInto('userProposalGroupLastRead')
    .values(values)
    .onConflict((oc) =>
      oc.columns(['userId', 'proposalGroupId']).doUpdateSet({ lastReadAt: now })
    )
    .execute();

  revalidateTag('groups'); // revalidate here on change
}

export async function getGroups(daoSlug: string, userId?: string) {
  'use cache';
  cacheLife('minutes');

  daoSlugSchema.parse(daoSlug);

  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select(['id', 'name'])
    .executeTakeFirst();

  if (!dao) return null;

  const allGroups = await dbIndexer
    .selectFrom('proposalGroup')
    .select(['id', 'name', 'items', 'daoId'])
    .where('daoId', '=', dao.id)
    .where('name', '!=', 'UNGROUPED')
    .execute();

  const proposalItems: { externalId: string; governorId: string }[] = [];
  const topicItems: { externalId: string; daoDiscourseId: string }[] = [];

  allGroups.forEach((group) => {
    const items = group.items as ProposalGroupItem[];
    items.forEach((item) => {
      if (item.type === 'proposal') {
        proposalItems.push({
          externalId: item.externalId,
          governorId: item.governorId,
        });
      } else if (item.type === 'topic') {
        topicItems.push({
          externalId: item.externalId,
          daoDiscourseId: item.daoDiscourseId,
        });
      }
    });
  });

  // --- Optimized Bulk Queries ---

  const proposalsPromise =
    proposalItems.length > 0
      ? dbIndexer
          .selectFrom('proposal')
          .leftJoin('vote', 'vote.proposalId', 'proposal.id')
          .select([
            'proposal.id',
            'proposal.externalId',
            'proposal.governorId',
            'proposal.name',
            'proposal.author',
            'proposal.createdAt',
            'proposal.endAt',
            dbIndexer.fn.count('vote.id').as('voteCount'),
          ])
          .where((eb) =>
            eb.or(
              proposalItems.map((item) =>
                eb('proposal.externalId', '=', item.externalId).and(
                  'proposal.governorId',
                  '=',
                  item.governorId
                )
              )
            )
          )
          .groupBy(['proposal.id'])
          .execute()
      : Promise.resolve([]);

  const topicsPromise =
    topicItems.length > 0
      ? dbIndexer
          .selectFrom('discourseTopic')
          .select([
            'discourseTopic.externalId',
            'discourseTopic.daoDiscourseId',
            'discourseTopic.bumpedAt',
            'discourseTopic.postsCount',
            'discourseTopic.createdAt',
          ])
          .where((eb) =>
            eb.or(
              topicItems.map((item) =>
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

  const firstPostsPromise =
    topicItems.length > 0
      ? dbIndexer
          .selectFrom('discoursePost')
          .select([
            'discoursePost.topicId',
            'discoursePost.daoDiscourseId',
            'discoursePost.userId',
          ])
          .where((eb) =>
            eb.or(
              topicItems.map((item) =>
                eb('topicId', '=', parseInt(item.externalId, 10)).and(
                  'daoDiscourseId',
                  '=',
                  item.daoDiscourseId
                )
              )
            )
          )
          .where('discoursePost.postNumber', '=', 1)
          .execute()
      : Promise.resolve([]);

  const discourseUsersPromise =
    topicItems.length > 0
      ? firstPostsPromise.then((posts) => {
          if (!posts || posts.length === 0) return Promise.resolve([]);
          return dbIndexer
            .selectFrom('discourseUser')
            .select([
              'discourseUser.externalId',
              'discourseUser.daoDiscourseId',
              'discourseUser.username',
              'discourseUser.name',
              'discourseUser.avatarTemplate',
            ])
            .where((eb) =>
              eb.or(
                posts.map((post) =>
                  eb('externalId', '=', post.userId).and(
                    'daoDiscourseId',
                    '=',
                    post.daoDiscourseId
                  )
                )
              )
            )
            .execute();
        })
      : Promise.resolve([]);

  const [proposals, topics, firstPosts, discourseUsers] = await Promise.all([
    proposalsPromise,
    topicsPromise,
    firstPostsPromise,
    discourseUsersPromise,
  ]);
  // --- Maps for Efficient Lookups ---

  const proposalsMap = new Map(
    proposals.map((proposal) => [
      `${proposal.externalId}-${proposal.governorId}`,
      { ...proposal, voteCount: Number(proposal.voteCount) },
    ])
  );

  const topicsMap = new Map(
    topics.map((topic) => [
      `${topic.externalId}-${topic.daoDiscourseId}`,
      topic,
    ])
  );

  const firstPostsMap = new Map(
    firstPosts.map((post) => [`${post.topicId}-${post.daoDiscourseId}`, post])
  );

  const discourseUsersMap = new Map(
    discourseUsers.map((user) => [
      `${user.externalId}-${user.daoDiscourseId}`,
      {
        username: user.username,
        name: user.name,
        avatarTemplate: user.avatarTemplate,
      },
    ])
  );

  const lastReadMap = new Map<string, Date | null>();
  if (userId) {
    const lastReads = await dbWeb
      .selectFrom('userProposalGroupLastRead')
      .where('userId', '=', userId)
      .select(['proposalGroupId', 'lastReadAt'])
      .execute();

    lastReads.forEach((lr) => {
      lastReadMap.set(lr.proposalGroupId, lr.lastReadAt);
    });
  }

  const now = new Date().getTime();

  // --- Group Processing ---

  const groupsWithTimestamps = allGroups.map((group) => {
    const items = group.items as ProposalGroupItem[];
    let newestItemTimestamp = 0;
    let hasActiveProposal = false;
    let earliestEndTime = Infinity;
    let groupVotesCount = 0;
    let groupPostsCount = 0;

    // Author Info
    let authorInfo: {
      originalAuthorName: string;
      originalAuthorPicture: string;
      createdAt: Date;
    } = {
      originalAuthorName: 'Unknown',
      originalAuthorPicture:
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
      createdAt: new Date(0),
    };

    const allItemsWithAuthors: {
      originalAuthorName: string;
      originalAuthorPicture: string;
      createdAt: Date;
    }[] = [];

    for (const item of items) {
      let itemTimestamp = 0;

      if (item.type === 'proposal') {
        const proposal = proposalsMap.get(
          `${item.externalId}-${item.governorId}`
        );
        if (proposal) {
          itemTimestamp = new Date(proposal.createdAt).getTime();
          groupVotesCount += proposal.voteCount;

          if (proposal.endAt && new Date(proposal.endAt).getTime() > now) {
            hasActiveProposal = true;
            earliestEndTime = Math.min(
              earliestEndTime,
              new Date(proposal.endAt).getTime()
            );
          }
          // For author info
          allItemsWithAuthors.push({
            originalAuthorName: proposal.author || 'Unknown',
            originalAuthorPicture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
            createdAt: proposal.createdAt,
          });
        }
      } else if (item.type === 'topic') {
        const topic = topicsMap.get(
          `${item.externalId}-${item.daoDiscourseId}`
        );
        if (topic) {
          itemTimestamp = new Date(topic.bumpedAt).getTime();
          groupPostsCount += topic.postsCount;

          //For Author Info
          const firstPost = firstPostsMap.get(
            `${topic.externalId}-${topic.daoDiscourseId}`
          );
          if (firstPost) {
            const discourseUser = discourseUsersMap.get(
              `${firstPost.userId}-${topic.daoDiscourseId}`
            );
            if (discourseUser) {
              const avatarUrl = discourseUser.avatarTemplate.replace(
                /{size}/g,
                '240'
              ); //or other size
              allItemsWithAuthors.push({
                originalAuthorName:
                  discourseUser.username || discourseUser.name || 'Unknown',
                originalAuthorPicture: discourseUser.avatarTemplate.length
                  ? avatarUrl
                  : `https://api.dicebear.com/9.x/pixel-art/png?seed=${discourseUser.username}`,
                createdAt: topic.createdAt,
              });
            }
          }
        }
      }

      newestItemTimestamp = Math.max(newestItemTimestamp, itemTimestamp);
    }

    // Sort allItemsWithAuthors by createdAt and get the first one
    allItemsWithAuthors.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (allItemsWithAuthors.length > 0) {
      authorInfo = allItemsWithAuthors[0];
    }

    const groupId = group.id.toString();
    const lastReadAt = lastReadMap.get(groupId);
    const hasNewActivity = userId
      ? lastReadAt
        ? newestItemTimestamp > lastReadAt.getTime()
        : true
      : false;

    return {
      ...group,
      votesCount: groupVotesCount,
      postsCount: groupPostsCount - 1,
      newestActivityTimestamp: newestItemTimestamp,
      hasNewActivity,
      hasActiveProposal,
      earliestEndTime: hasActiveProposal ? earliestEndTime : Infinity,
      originalAuthorName: authorInfo.originalAuthorName,
      originalAuthorPicture: authorInfo.originalAuthorPicture,
      groupName: group.name,
    };
  });

  // --- Sorting ---
  groupsWithTimestamps.sort((a, b) => {
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
    groups: groupsWithTimestamps,
  };
}

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;

const ARBITRUM_COINGECKO_ID = 'arbitrum';

export const getTokenPrice = async (daoSlug: string) => {
  'use cache';
  cacheLife('hours');

  daoSlugSchema.parse(daoSlug);

  if (daoSlug !== 'arbitrum') return null;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${ARBITRUM_COINGECKO_ID}/market_chart?vs_currency=usd&days=1`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(
        'Failed to fetch price data:',
        res.status,
        res.statusText,
        url
      );
      return null;
    }

    const data = await res.json();
    if (data && data.prices && data.prices.length > 0) {
      const latestPrice = data.prices[data.prices.length - 1][1];
      return latestPrice;
    }
    return null;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return null;
  }
};

export async function getTotalVotingPower(daoId: string): Promise<number> {
  'use cache';
  cacheLife('hours');

  daoIdSchema.parse(daoId);

  const result = await dbIndexer
    .with('latest_voting_power', (db) =>
      db
        .selectFrom('votingPower')
        .select(['voter', sql<string>`MAX(timestamp)`.as('latest_timestamp')])
        .where('daoId', '=', daoId)
        .where(
          'votingPower.voter',
          '!=',
          '0x00000000000000000000000000000000000A4B86'
        )
        .groupBy('voter')
    )
    .selectFrom('votingPower as vp')
    .innerJoin('latest_voting_power as lvp', (join) =>
      join
        .onRef('vp.voter', '=', 'lvp.voter')
        .on(sql`vp.timestamp`, '=', sql`lvp.latest_timestamp`)
    )
    .where('vp.daoId', '=', daoId)
    .select(
      sql<number>`COALESCE(SUM(vp.voting_power), 0)`.as('totalVotingPower')
    )
    .executeTakeFirst();

  return result?.totalVotingPower || 0;
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

  try {
    const response = await fetch('https://api.tally.xyz/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.TALLY_API_KEY ?? '',
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
    });

    if (!response.ok) {
      console.error(`Failed to fetch balance for address ${address}`);

      return 0;
    }

    const data: TallyResponse = await response.json();

    return data.data.balances.reduce((total, token) => {
      if (token.quoteRate && token.balance) {
        const balance = Number(token.balance) / Math.pow(10, token.decimals);
        return total + balance * token.quoteRate;
      }
      return total;
    }, 0);
  } catch (error) {
    console.error(`Error fetching balance for address ${address}:`, error);
    return 0;
  }
}

export const getTreasuryBalance = async (daoSlug: string) => {
  'use cache';
  cacheLife('days');

  daoSlugSchema.parse(daoSlug);

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
    const balances = await Promise.all(
      TREASURY_ADDRESSES.map((address) => fetchBalanceForAddress(address))
    );

    const totalBalance = balances.reduce((sum, balance) => sum + balance, 0);
    return totalBalance;
  } catch (error) {
    console.error('Error calculating total treasury balance:', error);
    return null;
  }
};
