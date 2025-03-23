'use server';

import { AsyncReturnType } from '@/lib/utils';
import {
  dbIndexer,
  DiscourseTopic,
  Proposal,
  Selectable,
} from '@proposalsapp/db-indexer';
import { ProposalGroupItem } from '@/lib/types';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { dbWeb } from '@proposalsapp/db-web';
import { revalidatePath } from 'next/cache';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { cache } from 'react';

export async function markAllAsRead(daoSlug: string) {
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

  revalidatePath(`/app/[daoSlug]`);
}

export async function getGroups(daoSlug: string, userId?: string) {
  'use cache';
  cacheLife('minutes');

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

const fetchDataWithCache = cache(async (url: string) => {
  const res = await fetch(url, { next: { revalidate: 3600 } }); // 1 hour cache
  if (!res.ok) {
    console.error('Failed to fetch data:', res.status, res.statusText, url);
    return null; // Or throw error if you prefer
  }
  return res.json();
});

async function fetchTokenData(coingeckoId: string) {
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}`;
  return fetchDataWithCache(url);
}

async function fetchMarketChartData(coingeckoId: string) {
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=1`; // Just to get current price
  return fetchDataWithCache(url);
}

export const getTokenPrice = async (daoSlug: string) => {
  if (daoSlug !== 'arbitrum') return null; // For now, only Arbitrum
  try {
    const data = await fetchMarketChartData(ARBITRUM_COINGECKO_ID);
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

export const getMarketCap = async (daoSlug: string) => {
  if (daoSlug !== 'arbitrum') return null; // For now, only Arbitrum
  try {
    const data = await fetchTokenData(ARBITRUM_COINGECKO_ID);
    if (data && data.market_data && data.market_data.market_cap.usd) {
      return data.market_data.market_cap.usd;
    }
    return null;
  } catch (error) {
    console.error('Error fetching market cap:', error);
    return null;
  }
};

export const getTreasuryBalance = async (daoSlug: string) => {
  if (daoSlug !== 'arbitrum') return null; // For now, only Arbitrum

  return 1048651116.24;
};
