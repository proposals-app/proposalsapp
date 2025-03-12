import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { otel } from '@/lib/otel';
import { AsyncReturnType, superjson_cache } from '@/lib/utils';
import { ProcessedVote, processResultsAction } from '@/lib/results_processing';
import {
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  Selectable,
  sql,
  Vote,
} from '@proposalsapp/db-indexer';
import { unstable_cache } from 'next/cache';
import { ProposalGroupItem } from '@/lib/types';

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

async function getDelegateByVoterAddress(
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
        .selectAll()
        .where('dao.slug', '=', daoSlug)
        .executeTakeFirstOrThrow();

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

export async function getDelegateByDiscourseUser(
  discourseUserId: number,
  daoSlug: string,
  withPeriodCheck: boolean,
  topicIds?: string[],
  proposalIds?: string[]
) {
  'use server';
  return otel('get-delegate-by-discourse-user', async () => {
    try {
      const dao = await db
        .selectFrom('dao')
        .selectAll()
        .where('dao.slug', '=', daoSlug)
        .executeTakeFirstOrThrow();

      const daoDiscourse = await db
        .selectFrom('daoDiscourse')
        .selectAll()
        .where('daoId', '=', dao.id)
        .executeTakeFirstOrThrow();

      // Fetch the discourse user
      const discourseUser = await db
        .selectFrom('discourseUser')
        .selectAll()
        .where('externalId', '=', discourseUserId)
        .where('daoDiscourseId', '=', daoDiscourse.id)
        .executeTakeFirst();

      if (!discourseUser) return null;

      // Find the associated delegate via delegateToDiscourseUser
      const delegateToDiscourseUser = await db
        .selectFrom('delegateToDiscourseUser')
        .selectAll()
        .where('discourseUserId', '=', discourseUser.id)
        .executeTakeFirst();

      if (!delegateToDiscourseUser) return null;

      // Find the associated voter via delegateToVoter
      const delegateToVoter = await db
        .selectFrom('delegateToVoter')
        .selectAll()
        .where('delegateId', '=', delegateToDiscourseUser.delegateId)
        .executeTakeFirst();

      if (!delegateToVoter) return null;

      // Fetch the voter using the voter ID from delegateToVoter
      const voter = await db
        .selectFrom('voter')
        .selectAll()
        .where('id', '=', delegateToVoter.voterId)
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

        if (topicIds && topicIds.length > 0) {
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
        .where(
          'delegateToDiscourseUser.discourseUserId',
          '=',
          discourseUser.id
        );

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

      const latestVotingPower = await db
        .selectFrom('votingPower')
        .selectAll()
        .where('voter', '=', delegateData.voterAddress)
        .where('daoId', '=', dao.id)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .executeTakeFirst();

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
              latestVotingPower: latestVotingPower,
            }
          : null,
      };
    } catch (error) {
      console.error('Error fetching delegate by discourse user:', error);
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

export const getDelegateByVoterAddress_cache = unstable_cache(
  async (
    voterAddress: string,
    daoSlug: string,
    withPeriodCheck: boolean,
    topicIds: string[],
    proposalIds: string[]
  ) => {
    return await getDelegateByVoterAddress(
      voterAddress,
      daoSlug,
      withPeriodCheck,
      topicIds,
      proposalIds
    );
  },
  ['get-delegate-by-voter-address'],
  { revalidate: 60 * 30, tags: ['get-delegate-by-voter-address'] }
);

export const getDelegateByDiscourseUser_cached = unstable_cache(
  async (
    discourseUserId: number,
    daoSlug: string,
    withPeriodCheck: boolean,
    topicIds?: string[],
    proposalIds?: string[]
  ) => {
    return await getDelegateByDiscourseUser(
      discourseUserId,
      daoSlug,
      withPeriodCheck,
      topicIds,
      proposalIds
    );
  },
  ['get-delegate-by-discourse-user'],
  { revalidate: 60 * 30, tags: ['get-delegate-by-discourse-user'] }
);

export const getDiscourseUser_cached = unstable_cache(
  async (userId: number, daoDiscourseId: string) => {
    return await getDiscourseUser(userId, daoDiscourseId);
  },
  ['get-discourse-user'],
  { revalidate: 60 * 30, tags: ['get-discourse-user'] }
);

export const getPostLikesCount_cached = unstable_cache(
  async (externalPostId: number, daoDiscourseId: string) => {
    return await getPostLikesCount(externalPostId, daoDiscourseId);
  },
  ['get-post-likes-count'],
  { revalidate: 60 * 5, tags: ['get-post-likes-count'] }
);

export const getPostLikedUsers_cached = unstable_cache(
  async (externalPostId: number, daoDiscourseId: string) => {
    return await getPostLikedUsers(externalPostId, daoDiscourseId);
  },
  ['get-post-liked-users'],
  { revalidate: 60 * 5, tags: ['get-post-liked-users'] }
);

export const getVotingPower_cache = unstable_cache(
  async (itemId: string) => {
    return await getVotingPower(itemId);
  },
  ['get-voting-power'],
  { revalidate: 60 * 5, tags: ['get-voting-power'] }
);
