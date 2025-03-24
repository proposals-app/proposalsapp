'use server';

import { AsyncReturnType } from '@/lib/utils';
import {
  dbIndexer,
  DiscourseTopic,
  Proposal,
  Selectable,
  sql,
} from '@proposalsapp/db-indexer';
import { ProposalGroupItem } from '@/lib/types';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { dbWeb } from '@proposalsapp/db-web';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';
import { revalidateTag } from 'next/cache';
import { daoIdSchema, daoSlugSchema, groupIdSchema } from '@/lib/validations';

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
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    return;
  }

  const allGroups = await dbIndexer
    .selectFrom('proposalGroup')
    .where('daoId', '=', dao.id)
    .selectAll()
    .execute();

  const now = new Date();

  for (const group of allGroups) {
    await dbWeb
      .insertInto('userProposalGroupLastRead')
      .values({
        userId: userId,
        proposalGroupId: group.id,
        lastReadAt: now,
      })
      .onConflict((oc) =>
        oc
          .columns(['userId', 'proposalGroupId'])
          .doUpdateSet({ lastReadAt: now })
      )
      .execute();
  }

  revalidateTag('groups');
}

export async function getGroups(daoSlug: string, userId?: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('groups');

  daoSlugSchema.parse(daoSlug);

  // Fetch the DAO based on the slug
  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  // First, fetch all groups for the DAO
  const allGroups = await dbIndexer
    .selectFrom('proposalGroup')
    .selectAll()
    .where('daoId', '=', dao.id)
    .where('name', '!=', 'UNGROUPED')
    .execute();

  // Extract all item IDs to fetch in bulk
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

  // Fetch proposals in bulk
  const proposals =
    proposalItems.length > 0
      ? await dbIndexer
          .selectFrom('proposal')
          .leftJoin('vote', 'vote.proposalId', 'proposal.id')
          .select([
            'proposal.id',
            'proposal.externalId',
            'proposal.name',
            'proposal.body',
            'proposal.url',
            'proposal.discussionUrl',
            'proposal.choices',
            'proposal.quorum',
            'proposal.proposalState',
            'proposal.markedSpam',
            'proposal.createdAt',
            'proposal.startAt',
            'proposal.endAt',
            'proposal.blockCreatedAt',
            'proposal.txid',
            'proposal.metadata',
            'proposal.daoId',
            'proposal.author',
            'proposal.governorId',
            dbIndexer.fn.count('vote.id').as('voteCount'),
          ])
          .where((eb) =>
            eb.or(
              proposalItems.map((item) =>
                eb('vote.proposalExternalId', '=', item.externalId).and(
                  'vote.governorId',
                  '=',
                  item.governorId
                )
              )
            )
          )
          .groupBy(['proposal.id'])
          .execute()
      : [];

  // Fetch topics in bulk
  const topics =
    topicItems.length > 0
      ? await dbIndexer
          .selectFrom('discourseTopic')
          .selectAll()
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
      : [];

  // Create a map for faster lookup
  const proposalsMap = new Map<
    string,
    Selectable<Proposal> & { voteCount: string | number | bigint }
  >();
  proposals.forEach((proposal) => {
    proposalsMap.set(`${proposal.externalId}-${proposal.governorId}`, proposal);
  });
  const topicsMap = new Map<string, Selectable<DiscourseTopic>>();
  topics.forEach((topic) => {
    topicsMap.set(`${topic.externalId}-${topic.daoDiscourseId}`, topic);
  });

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

  const groupsWithTimestamps = allGroups.map((group) => {
    const items = group.items as ProposalGroupItem[];
    let newestItemTimestamp = 0;
    let hasActiveProposal = false;
    let earliestEndTime = Infinity;

    // Initialize group-specific counters
    let groupVotesCount = 0;
    let groupPostsCount = 0;

    for (const item of items) {
      let itemTimestamp = 0;
      if (item.type === 'proposal') {
        const proposal = proposalsMap.get(
          `${item.externalId}-${item.governorId}`
        );
        if (proposal) {
          itemTimestamp = new Date(proposal.createdAt).getTime();
          // Add votes for this specific proposal to the group total
          groupVotesCount += Number(proposal.voteCount);

          // Check if proposal is active
          if (proposal.endAt && new Date(proposal.endAt).getTime() > now) {
            hasActiveProposal = true;
            // Track the earliest end time among active proposals
            earliestEndTime = Math.min(
              earliestEndTime,
              new Date(proposal.endAt).getTime()
            );
          }
        }
      } else if (item.type === 'topic') {
        const topic = topicsMap.get(
          `${item.externalId}-${item.daoDiscourseId}`
        );
        if (topic) {
          itemTimestamp = new Date(topic.bumpedAt).getTime();
          // Add posts for this specific topic to the group total
          groupPostsCount += Number(topic.postsCount);
        }
      }
      newestItemTimestamp = Math.max(newestItemTimestamp, itemTimestamp);
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
      postsCount: groupPostsCount,
      newestActivityTimestamp: newestItemTimestamp,
      hasNewActivity,
      hasActiveProposal,
      earliestEndTime: hasActiveProposal ? earliestEndTime : Infinity,
    };
  });

  // Update the sorting logic
  groupsWithTimestamps.sort((a, b) => {
    // First, separate active and inactive proposals
    if (a.hasActiveProposal && !b.hasActiveProposal) return -1;
    if (!a.hasActiveProposal && b.hasActiveProposal) return 1;

    // If both have active proposals, sort by earliest end time
    if (a.hasActiveProposal && b.hasActiveProposal) {
      return a.earliestEndTime - b.earliestEndTime;
    }

    // If neither has active proposals, sort by newest activity
    return b.newestActivityTimestamp - a.newestActivityTimestamp;
  });

  return {
    daoName: dao.name,
    daoId: dao.id,
    groups: groupsWithTimestamps,
  };
}

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;

export async function getGroupHeader(groupId: string): Promise<{
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
}> {
  'use cache';
  cacheLife('hours');

  groupIdSchema.parse(groupId);

  interface AuthorInfo {
    originalAuthorName: string;
    originalAuthorPicture: string;
    createdAt: Date;
  }

  const group = await dbIndexer
    .selectFrom('proposalGroup')
    .where('id', '=', groupId)
    .selectAll()
    .executeTakeFirst();

  if (!group) {
    return {
      originalAuthorName: 'Unknown',
      originalAuthorPicture:
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
      groupName: 'Unknown Group',
    };
  }

  const items = group.items as ProposalGroupItem[];

  let authorInfo = {
    originalAuthorName: 'Unknown',
    originalAuthorPicture:
      'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
  };

  // Extract all item IDs to fetch in bulk
  const proposalItems: { externalId: string; governorId: string }[] = [];
  const topicItems: { externalId: string; daoDiscourseId: string }[] = [];

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

  // Fetch proposals in bulk
  const proposals =
    proposalItems.length > 0
      ? await dbIndexer
          .selectFrom('proposal')
          .selectAll()
          .where((eb) =>
            eb.or(
              proposalItems.map((item) =>
                eb('externalId', '=', item.externalId).and(
                  'governorId',
                  '=',
                  item.governorId
                )
              )
            )
          )
          .execute()
      : [];

  // Fetch topics in bulk
  const topics =
    topicItems.length > 0
      ? await dbIndexer
          .selectFrom('discourseTopic')
          .selectAll()
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
      : [];

  // Helper function to fetch topic and its author info
  const getTopicAuthorInfo = async (
    topic: Selectable<DiscourseTopic>
  ): Promise<AuthorInfo | null> => {
    try {
      const discourseFirstPost = await dbIndexer
        .selectFrom('discoursePost')
        .where('discoursePost.topicId', '=', topic.externalId)
        .where('daoDiscourseId', '=', topic.daoDiscourseId)
        .where('discoursePost.postNumber', '=', 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostAuthor = await dbIndexer
        .selectFrom('discourseUser')
        .where('discourseUser.externalId', '=', discourseFirstPost.userId)
        .where('daoDiscourseId', '=', topic.daoDiscourseId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        originalAuthorName:
          discourseFirstPostAuthor.username ||
          discourseFirstPostAuthor.name ||
          'Unknown',
        originalAuthorPicture: discourseFirstPostAuthor.avatarTemplate.length
          ? discourseFirstPostAuthor.avatarTemplate
          : `https://api.dicebear.com/9.x/pixel-art/png?seed=${discourseFirstPostAuthor.username}`,
        createdAt: topic.createdAt,
      };
    } catch (topicError) {
      console.error('Error fetching topic author data:', topicError);
      return null;
    }
  };

  // Helper function to fetch proposal and its author info
  const getProposalAuthorInfo = async (
    proposal: Selectable<Proposal>
  ): Promise<AuthorInfo | null> => {
    try {
      return {
        originalAuthorName: proposal.author || 'Unknown',
        originalAuthorPicture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
        createdAt: proposal.createdAt,
      };
    } catch (proposalError) {
      console.error('Error fetching proposal author data:', proposalError);
      return null;
    }
  };

  // Fetch all topics with their author info
  const topicsWithAuthors = await Promise.all(
    topics.map((topic) => getTopicAuthorInfo(topic))
  );

  // Fetch all proposals with their author info
  const proposalsWithAuthors = await Promise.all(
    proposals.map((proposal) => getProposalAuthorInfo(proposal))
  );

  // Combine topics and proposals, filter out null results, and sort by createdAt
  const allItemsWithAuthors = [...topicsWithAuthors, ...proposalsWithAuthors]
    .filter((item): item is NonNullable<AuthorInfo> => Boolean(item))
    .sort(
      (a, b) =>
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
}

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
