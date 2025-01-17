import { VotesFilterEnum } from '@/app/searchParams';
import { otel } from '@/lib/otel';
import { AsyncReturnType } from '@/lib/utils';
import {
  DB,
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  Selectable,
  SelectQueryBuilder,
  sql,
  Vote,
} from '@proposalsapp/db';

export async function getFeedForGroup(
  groupID: string,
  commentsFilter: boolean,
  votesFilter: VotesFilterEnum,
  page: number = 1
) {
  'use server';
  return otel('get-feed-for-group', async () => {
    const itemsPerPage = 25;
    const totalItems = itemsPerPage * page;

    let votes: Selectable<Vote>[] = [];
    let posts: Selectable<DiscoursePost>[] = [];

    try {
      // Fetch the proposal group
      const group = await db
        .selectFrom('proposalGroup')
        .selectAll()
        .where('id', '=', groupID)
        .executeTakeFirstOrThrow();

      if (!group) {
        return { votes, posts, hasMore: false };
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

      // Build the base query for votes
      let queries: SelectQueryBuilder<DB, any, any>[] = [];

      if (proposalIds.length > 0) {
        const votesQuery = db
          .selectFrom('vote')
          .where('proposalId', 'in', proposalIds)
          .$if(votesFilter !== VotesFilterEnum.ALL, (qb) => {
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
          .select([
            'id',
            sql<Date>`time_created`.as('timestamp'),
            sql<'vote'>`'vote'`.as('type'),
            'id as originalId',
          ]);

        queries.push(votesQuery);
      }

      // Add posts query if comments are enabled and there are topics
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
          .select([
            'id',
            sql<Date>`created_at`.as('timestamp'),
            sql<'post'>`'post'`.as('type'),
            'id as originalId',
          ]);

        queries.push(postsQuery);
      }

      // Combine queries if there are multiple
      let finalQuery = queries[0];
      for (let i = 1; i < queries.length; i++) {
        finalQuery = finalQuery.union(queries[i]);
      }

      if (!finalQuery) {
        return { votes: [], posts: [], hasMore: false };
      }

      // Get total count
      const countResult = await db
        .selectFrom(finalQuery.as('combined'))
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirst();

      const totalCount = Number(countResult?.count ?? 0);

      // Get paginated items
      const paginatedItems = await finalQuery
        .orderBy('timestamp', 'desc')
        .limit(totalItems)
        .execute();

      // Fetch full data for each paginated item
      const votePromises: Promise<Selectable<Vote> | null>[] = [];
      const postPromises: Promise<Selectable<DiscoursePost> | null>[] = [];

      paginatedItems.forEach((item) => {
        if (item.type === 'vote') {
          votePromises.push(
            db
              .selectFrom('vote')
              .selectAll()
              .where('id', '=', item.originalId)
              .executeTakeFirst()
              .then((result) => result ?? null)
          );
        } else {
          postPromises.push(
            db
              .selectFrom('discoursePost')
              .selectAll()
              .where('id', '=', item.originalId)
              .executeTakeFirst()
              .then((result) => result ?? null)
          );
        }
      });

      // Wait for all promises to resolve
      const [resolvedVotes, resolvedPosts] = await Promise.all([
        Promise.all(votePromises),
        Promise.all(postPromises),
      ]);

      // Filter out null values and assign to result arrays
      votes = resolvedVotes.filter((v): v is Selectable<Vote> => v !== null);
      posts = resolvedPosts.filter(
        (p): p is Selectable<DiscoursePost> => p !== null
      );

      const hasMore = totalCount > totalItems;

      return {
        votes,
        posts,
        hasMore,
      };
    } catch (error) {
      console.error('Error fetching feed:', error);
      return { votes: [], posts: [], hasMore: false };
    }
  });
}

export async function getProposalsByIds(proposalIds: string[]) {
  'use server';
  return otel('get-proposals-by-ids', async () => {
    if (!proposalIds || proposalIds.length === 0) {
      return [];
    }

    const proposals = await db
      .selectFrom('proposal')
      .selectAll()
      .where('proposal.id', 'in', proposalIds)
      .execute();

    return proposals;
  });
}

export async function getDiscourseUser(userId: number, daoDiscourseId: string) {
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

export async function getVotingPower(
  voteId: string,
  proposalIds: string[],
  topicIds: string[]
): Promise<{
  startTime: Date;
  endTime: Date;
  initialVotingPower: number;
  finalVotingPower: number;
  change: number | null;
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

      // Fetch the proposals
      let proposals: Selectable<Proposal>[] = [];
      if (proposalIds.length > 0) {
        proposals = await db
          .selectFrom('proposal')
          .selectAll()
          .where('id', 'in', proposalIds)
          .execute();
      }

      // Fetch the topics
      let topics: Selectable<DiscourseTopic>[] = [];
      if (topicIds.length > 0) {
        topics = await db
          .selectFrom('discourseTopic')
          .selectAll()
          .where('id', 'in', topicIds)
          .execute();
      }

      // Ensure there are either proposals or topics available
      if (!proposals.length && !topics.length) {
        throw new Error('No proposals or topics found');
      }

      // Fetch the DAO and its discourse to get the start time
      let daoId: string | undefined;
      if (proposals.length > 0) {
        const dao = await db
          .selectFrom('dao')
          .selectAll()
          .where('id', '=', proposals[0].daoId)
          .executeTakeFirst();
        daoId = dao?.id;
      } else {
        const topicDaoDiscourseId = topics[0].daoDiscourseId;
        const topicDao = await db
          .selectFrom('daoDiscourse')
          .innerJoin('dao', 'dao.id', 'daoDiscourse.daoId')
          .selectAll()
          .where('daoDiscourse.id', '=', topicDaoDiscourseId)
          .executeTakeFirst();
        daoId = topicDao?.daoId;
      }

      if (!daoId) {
        throw new Error('DAO not found');
      }

      // Determine the start time as the earliest creation time among proposals and topics
      const proposalStartTimes = proposals.map((proposal) =>
        proposal.timeStart.getTime()
      );
      const topicStartTimes = topics.map((topic) => topic.createdAt.getTime());

      const proposalEndTimes = proposals.map((proposal) =>
        proposal.timeEnd.getTime()
      );
      const topicEndTimes = topics.map((topic) => topic.lastPostedAt.getTime());

      const startTime = new Date(
        Math.min(...proposalStartTimes, ...topicStartTimes)
      );

      const endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));

      // Fetch the closest voting power record to the start time
      const initialVotingPowerRecord = await db
        .selectFrom('votingPower')
        .selectAll()
        .where('voter', '=', vote.voterAddress)
        .where('daoId', '=', daoId)
        .where('timestamp', '<=', startTime)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .executeTakeFirst();

      initialVotingPowerRecord?.timestamp;

      // Fetch the closest voting power record to the end time
      const finalVotingPowerRecord = await db
        .selectFrom('votingPower')
        .selectAll()
        .where('voter', '=', vote.voterAddress)
        .where('daoId', '=', daoId)
        .where('timestamp', '<=', endTime)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .executeTakeFirst();

      const initialVotingPower = initialVotingPowerRecord?.votingPower ?? 0;
      const finalVotingPower = finalVotingPowerRecord?.votingPower ?? 0;

      const initialVotingPowerTime = new Date(
        initialVotingPowerRecord?.timestamp ?? 0
      );
      const finalVotingPowerTime = new Date(
        finalVotingPowerRecord?.timestamp ?? 0
      );

      let change: number | null = null;
      if (initialVotingPower !== finalVotingPower) {
        change =
          ((finalVotingPower - initialVotingPower) / initialVotingPower) * 100;
      }

      return {
        startTime: initialVotingPowerTime,
        endTime: finalVotingPowerTime,
        initialVotingPower,
        finalVotingPower,
        change,
      };
    } catch (error) {
      console.error('Error fetching voting power:', error);
      throw error; // Re-throw the error after logging
    }
  });
}

export async function getDelegate(
  voterAddress: string,
  daoSlug: string,
  topicIds: string[],
  proposalIds?: string[]
) {
  'use server';
  return otel('get-delegate', async () => {
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
        proposal.timeStart.getTime()
      );
      proposalEndTimes = proposals.map((proposal) =>
        proposal.timeEnd.getTime()
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
    const startTime = new Date(
      Math.min(...proposalStartTimes, ...topicStartTimes)
    );

    const endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));

    // Fetch the delegate data
    const delegateData = await db
      .selectFrom('delegate')
      .innerJoin('delegateToVoter', 'delegate.id', 'delegateToVoter.delegateId')
      .where('delegateToVoter.voterId', '=', voter.id)
      .where('delegate.daoId', '=', dao.id)
      .select('delegate.id')
      .executeTakeFirst();

    if (!delegateData) return null;

    // Fetch the DelegateToDiscourseUser data
    const delegateToDiscourseUserData = await db
      .selectFrom('delegateToDiscourseUser')
      .where('delegateId', '=', delegateData.id)
      .leftJoin(
        'discourseUser',
        'discourseUser.id',
        'delegateToDiscourseUser.discourseUserId'
      )
      .where('periodStart', '<=', startTime)
      .where('periodEnd', '>=', endTime)
      .selectAll()
      .executeTakeFirst();

    // Fetch the DelegateToVoter data
    const delegateToVoterData = await db
      .selectFrom('delegateToVoter')
      .where('delegateId', '=', delegateData.id)
      .leftJoin('voter', 'voter.id', 'delegateToVoter.voterId')
      .where('periodStart', '<=', startTime)
      .where('periodEnd', '>=', endTime)
      .selectAll()
      .executeTakeFirst();

    // Combine the results into a single object
    const result = {
      delegate: delegateData,
      delegatetodiscourseuser: delegateToDiscourseUserData,
      delegatetovoter: delegateToVoterData,
    };

    return result;
  });
}

export type VotingPowerChangeType = AsyncReturnType<typeof getVotingPower>;
export type FeedDataType = AsyncReturnType<typeof getFeedForGroup>;
