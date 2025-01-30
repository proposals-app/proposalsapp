import { VotesFilterEnum } from '@/app/searchParams';
import { otel } from '@/lib/otel';
import { AsyncReturnType, superjson_cache } from '@/lib/utils';
import { ProcessedVote, processResultsAction } from '@/lib/votes_processing';
import {
  db,
  DiscoursePost,
  Proposal,
  Selectable,
  sql,
  Vote,
} from '@proposalsapp/db';
import { unstable_cache } from 'next/cache';

export async function getFeed(
  groupID: string,
  commentsFilter: boolean,
  votesFilter: VotesFilterEnum
): Promise<{ votes: ProcessedVote[]; posts: Selectable<DiscoursePost>[] }> {
  'use server';
  return otel('get-feed-for-group', async () => {
    let posts: Selectable<DiscoursePost>[] = [];

    try {
      // Fetch the proposal group
      const group = await db
        .selectFrom('proposalGroup')
        .selectAll()
        .where('id', '=', groupID)
        .executeTakeFirstOrThrow();

      if (!group) {
        return { votes: [], posts };
      }

      // Extract proposal and topic IDs from group items
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

      // Fetch proposals to get details
      let proposals: Selectable<Proposal>[] = [];

      if (proposalIds.length > 0) {
        proposals = await db
          .selectFrom('proposal')
          .selectAll()
          .where('id', 'in', proposalIds)
          .execute();
      }

      // Fetch topics to get daoDiscourseId and externalIds
      let topicsExternalIds: number[] = [];
      let firstDaoDiscourseId: string | undefined;

      if (topicIds.length > 0) {
        const topics = await db
          .selectFrom('discourseTopic')
          .selectAll()
          .where('discourseTopic.id', 'in', topicIds)
          .execute();

        topicsExternalIds = topics.map((t) => t.externalId);
        firstDaoDiscourseId = topics[0]?.daoDiscourseId;
      }

      // Fetch votes for the proposals
      let votes: Selectable<Vote>[] = [];

      if (proposalIds.length > 0) {
        const votesQuery = db
          .selectFrom('vote')
          .where('proposalId', 'in', proposalIds)
          .$if(votesFilter !== undefined, (qb) => {
            switch (votesFilter) {
              case VotesFilterEnum.FIFTY_THOUSAND:
                return qb.where('votingPower', '>', 50000);
              case VotesFilterEnum.FIVE_HUNDRED_THOUSAND:
                return qb.where('votingPower', '>', 500000);
              case VotesFilterEnum.FIVE_MILLION:
                return qb.where('votingPower', '>', 5000000);
              default:
                return qb;
            }
          })
          .selectAll();

        votes = await votesQuery.orderBy('createdAt', 'desc').execute();
      }

      // Build the query for posts if comments are enabled and there are topics
      if (
        commentsFilter &&
        topicsExternalIds.length > 0 &&
        firstDaoDiscourseId
      ) {
        const postsQuery = db
          .selectFrom('discoursePost')
          .where('topicId', 'in', topicsExternalIds)
          .where('daoDiscourseId', '=', firstDaoDiscourseId)
          .where('postNumber', '!=', 1)
          .selectAll();

        posts = await postsQuery.orderBy('createdAt', 'desc').execute();
      }

      // Process votes using processResultsAction
      const processedVotes: ProcessedVote[] = [];

      for (const proposal of proposals) {
        const result = await processResultsAction(
          proposal,
          votes.filter((vote) => vote.proposalId === proposal.id),
          { withVotes: true, withTimeseries: false, aggregatedVotes: true }
        );

        if (result.votes) {
          processedVotes.push(...result.votes);
        }
      }

      return {
        votes: processedVotes,
        posts: posts.filter((p) => p.name != 'System'),
      };
    } catch (error) {
      console.error('Error fetching feed:', error);
      return { votes: [], posts: [] };
    }
  });
}

async function getDiscourseUser(userId: number, daoDiscourseId: string) {
  'use server';
  return otel('get-discourse-user', async () => {
    const discourseUser = await db
      .selectFrom('discourseUser')
      .selectAll()
      .where('daoDiscourseId', '=', daoDiscourseId)
      .where('externalId', '=', userId)
      .executeTakeFirst();

    return discourseUser;
  });
}

async function getVotingPower(voteId: string): Promise<{
  votingPowerAtVote: number; // Voting power at the time of the vote
  latestVotingPower: number; // Latest voting power
  change: number | null; // Relative change between latest and voting power at vote
}> {
  'use server';
  return otel('get-voting-power', async () => {
    try {
      // Fetch the vote to get voter address and timestamps
      const vote = await db
        .selectFrom('vote')
        .selectAll()
        .where('id', '=', voteId)
        .executeTakeFirstOrThrow();

      // Fetch the latest voting power
      const latestVotingPowerRecord = await db
        .selectFrom('votingPower')
        .selectAll()
        .where('voter', '=', vote.voterAddress)
        .where('daoId', '=', vote.daoId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .executeTakeFirst();

      const latestVotingPower = latestVotingPowerRecord?.votingPower ?? 0;

      // Compute the relative change
      let change: number | null = null;
      if (vote.votingPower !== 0) {
        const rawChange =
          ((latestVotingPower - vote.votingPower) / vote.votingPower) * 100;
        // Only set change if it's outside the range of -0.01 to 0.01
        if (rawChange > 0.01 || rawChange < -0.01) {
          change = rawChange;
        }
      }

      return {
        votingPowerAtVote: vote.votingPower,
        latestVotingPower,
        change,
      };
    } catch (error) {
      console.error('Error fetching voting power:', error);
      throw error; // Re-throw the error after logging
    }
  });
}

async function getDelegate(
  voterAddress: string,
  daoSlug: string,
  withPeriodCheck: boolean,
  topicIds: string[],
  proposalIds?: string[]
) {
  'use server';
  return otel('get-delegate', async () => {
    try {
      const dao = await db
        .selectFrom('dao')
        .where('slug', '=', daoSlug)
        .selectAll()
        .executeTakeFirst();

      if (!dao) return null;

      const voter = await db
        .selectFrom('voter')
        .where('address', '=', voterAddress)
        .selectAll()
        .executeTakeFirst();

      if (!voter) return null;

      let startTime: Date | undefined;
      let endTime: Date | undefined;

      if (withPeriodCheck) {
        // Fetch the timestamps from proposals and topics
        let proposalStartTimes: number[] = [];
        let proposalEndTimes: number[] = [];

        if (proposalIds && proposalIds.length > 0) {
          const proposals = await db
            .selectFrom('proposal')
            .selectAll()
            .where('id', 'in', proposalIds)
            .execute();

          proposalStartTimes = proposals.map((proposal) =>
            proposal.startAt.getTime()
          );
          proposalEndTimes = proposals.map((proposal) =>
            proposal.endAt.getTime()
          );
        }

        let topicStartTimes: number[] = [];
        let topicEndTimes: number[] = [];

        if (topicIds.length > 0) {
          const topics = await db
            .selectFrom('discourseTopic')
            .selectAll()
            .where('id', 'in', topicIds)
            .execute();

          topicStartTimes = topics.map((topic) => topic.createdAt.getTime());
          topicEndTimes = topics.map((topic) => topic.lastPostedAt.getTime());
        }

        // Determine the start and end times based on proposals and topics
        startTime = new Date(
          Math.min(...proposalStartTimes, ...topicStartTimes)
        );

        endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));
      }

      // Fetch the delegate with all related data in one query
      let query = db
        .selectFrom('delegate')
        .innerJoin(
          'delegateToVoter',
          'delegate.id',
          'delegateToVoter.delegateId'
        )
        .leftJoin(
          'delegateToDiscourseUser',
          'delegate.id',
          'delegateToDiscourseUser.delegateId'
        )
        .leftJoin(
          'discourseUser',
          'discourseUser.id',
          'delegateToDiscourseUser.discourseUserId'
        )
        .leftJoin('voter', 'voter.id', 'delegateToVoter.voterId')
        .where('delegateToVoter.voterId', '=', voter.id)
        .where('delegate.daoId', '=', dao.id);

      if (withPeriodCheck && startTime && endTime) {
        query = query
          .where('delegateToVoter.periodStart', '<=', startTime)
          .where('delegateToVoter.periodEnd', '>=', endTime);
      }

      const delegateData = await query
        .select([
          'delegate.id as delegateId',
          'discourseUser.name as discourseName',
          'discourseUser.username as discourseUsername',
          'discourseUser.avatarTemplate as discourseAvatarTemplate',
          'voter.ens as voterEns',
          'voter.address as voterAddress',
        ])
        .executeTakeFirst();

      if (!delegateData) return null;

      // Transform the data into the expected format
      return {
        delegate: { id: delegateData.delegateId },
        delegatetodiscourseuser: delegateData.discourseName
          ? {
              name: delegateData.discourseName,
              username: delegateData.discourseUsername,
              avatarTemplate: delegateData.discourseAvatarTemplate,
            }
          : null,
        delegatetovoter: delegateData.voterEns
          ? {
              ens: delegateData.voterEns,
              address: delegateData.voterAddress,
            }
          : null,
      };
    } catch (error) {
      console.error('Error fetching delegate:', error);
      return null;
    }
  });
}

async function getPostLikesCount(
  externalPostId: number,
  daoDiscourseId: string
) {
  'use server';
  return otel('get-post-likes-count', async () => {
    try {
      const result = await db
        .selectFrom('discoursePostLike')
        .select(sql<number>`count(*)`.as('count'))
        .where('externalDiscoursePostId', '=', externalPostId)
        .where('daoDiscourseId', '=', daoDiscourseId)
        .executeTakeFirst();

      return result?.count ?? 0;
    } catch (error) {
      console.error('Error fetching post likes count:', error);
      return 0;
    }
  });
}

async function getPostLikedUsers(
  externalPostId: number,
  daoDiscourseId: string
) {
  'use server';
  return otel('get-post-liked-users', async () => {
    try {
      const likedUsers = await db
        .selectFrom('discoursePostLike')
        .innerJoin(
          'discourseUser',
          'discourseUser.externalId',
          'discoursePostLike.externalUserId'
        )
        .where('discoursePostLike.externalDiscoursePostId', '=', externalPostId)
        .where('discoursePostLike.daoDiscourseId', '=', daoDiscourseId)
        .where('discourseUser.daoDiscourseId', '=', daoDiscourseId)
        .select(['discourseUser.username'])
        .distinct() // Ensure unique usernames
        .execute();

      return likedUsers.map((user) => user.username);
    } catch (error) {
      console.error('Error fetching post liked users:', error);
      return [];
    }
  });
}

export type VotingPowerReturnType = AsyncReturnType<typeof getVotingPower>;
export type FeedReturnType = AsyncReturnType<typeof getFeed>;

export const getFeed_cached = superjson_cache(
  async (
    groupId: string,
    commentsFilter: boolean,
    votesFilter: VotesFilterEnum
  ) => {
    return await getFeed(groupId, commentsFilter, votesFilter);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-feed-for-group'] }
);

export const getDelegate_cache = unstable_cache(
  async (
    voterAddress: string,
    daoSlug: string,
    topicIds: string[],
    proposalIds: string[]
  ) => {
    return await getDelegate(
      voterAddress,
      daoSlug,
      false,
      topicIds,
      proposalIds
    );
  },
  [],
  { revalidate: 60 * 5, tags: ['get-delegate'] }
);

export const getDiscourseUser_cached = unstable_cache(
  async (userId: number, daoDiscourseId: string) => {
    return await getDiscourseUser(userId, daoDiscourseId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-discourse-user'] }
);

export const getPostLikesCount_cached = unstable_cache(
  async (externalPostId: number, daoDiscourseId: string) => {
    return await getPostLikesCount(externalPostId, daoDiscourseId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-post-likes-count'] }
);

export const getPostLikedUsers_cached = unstable_cache(
  async (externalPostId: number, daoDiscourseId: string) => {
    return await getPostLikedUsers(externalPostId, daoDiscourseId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-post-liked-users'] }
);

export const getVotingPower_cache = unstable_cache(
  async (itemId: string) => {
    return await getVotingPower(itemId);
  },
  [],
  { revalidate: 60 * 5, tags: ['get-voting-power'] }
);
