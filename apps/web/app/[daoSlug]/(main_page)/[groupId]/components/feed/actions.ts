import { db, sql } from '@proposalsapp/db-indexer';

export async function getDiscourseUser(userId: number, daoDiscourseId: string) {
  'use server';

  const discourseUser = await db
    .selectFrom('discourseUser')
    .selectAll()
    .where('daoDiscourseId', '=', daoDiscourseId)
    .where('externalId', '=', userId)
    .executeTakeFirst();

  return discourseUser;
}

export async function getVoteItemDelegate(
  voterAddress: string,
  daoSlug: string,
  withPeriodCheck: boolean,
  topicIds: string[],
  proposalIds?: string[]
) {
  'use server';

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
      proposalEndTimes = proposals.map((proposal) => proposal.endAt.getTime());
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
    startTime = new Date(Math.min(...proposalStartTimes, ...topicStartTimes));

    endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));
  }

  // Fetch the delegate with all related data in one query
  let query = db
    .selectFrom('delegate')
    .innerJoin('delegateToVoter', 'delegate.id', 'delegateToVoter.delegateId')
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
      'voter.ens as voterEns',
      'voter.address as voterAddress',
      'voter.avatar as voterAvatar',
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

    delegatetovoter: delegateData.voterEns
      ? {
          ens: delegateData.voterEns,
          avatar: delegateData.voterAvatar,
          address: delegateData.voterAddress,
          latestVotingPower: latestVotingPower,
        }
      : null,
  };
}

export async function getDelegateByDiscourseUser(
  discourseUserId: number,
  daoSlug: string,
  withPeriodCheck: boolean,
  topicIds?: string[],
  proposalIds?: string[]
) {
  'use server';

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
      proposalEndTimes = proposals.map((proposal) => proposal.endAt.getTime());
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
    startTime = new Date(Math.min(...proposalStartTimes, ...topicStartTimes));

    endTime = new Date(Math.max(...proposalEndTimes, ...topicEndTimes));
  }

  // Fetch the delegate with all related data in one query
  let query = db
    .selectFrom('delegate')
    .innerJoin('delegateToVoter', 'delegate.id', 'delegateToVoter.delegateId')
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
    .where('delegateToDiscourseUser.discourseUserId', '=', discourseUser.id);

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
}

export async function getPostLikesCount(
  externalPostId: number,
  daoDiscourseId: string
) {
  'use server';

  const result = await db
    .selectFrom('discoursePostLike')
    .select(sql<number>`count(*)`.as('count'))
    .where('externalDiscoursePostId', '=', externalPostId)
    .where('daoDiscourseId', '=', daoDiscourseId)
    .executeTakeFirst();

  return result?.count ?? 0;
}

async function getPostLikedUsers(
  externalPostId: number,
  daoDiscourseId: string
) {
  'use server';

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
}
