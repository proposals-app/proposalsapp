'use server';
import {
  daoDiscourseIdSchema,
  daoSlugSchema,
  discourseUserIdSchema,
} from '@/lib/validations';
import { db, sql } from '@proposalsapp/db';

export async function getDiscourseUser(userId: number, daoDiscourseId: string) {
  // 'use cache';
  // cacheLife('hours');

  discourseUserIdSchema.parse(userId);
  daoDiscourseIdSchema.parse(daoDiscourseId);

  const discourseUser = await db.public
    .selectFrom('discourseUser')
    .selectAll()
    .where('daoDiscourseId', '=', daoDiscourseId)
    .where('externalId', '=', userId)
    .executeTakeFirst();

  return discourseUser;
}

export async function getDelegateByDiscourseUser(
  discourseUserId: number,
  daoSlug: string,
  withPeriodCheck: boolean,
  topicIds?: string[],
  proposalIds?: string[]
) {
  // 'use cache';
  // cacheLife('hours');

  discourseUserIdSchema.parse(discourseUserId);
  daoSlugSchema.parse(daoSlug);

  const dao = await db.public
    .selectFrom('dao')
    .selectAll()
    .where('dao.slug', '=', daoSlug)
    .executeTakeFirst();

  if (!dao) return null;

  const daoDiscourse = await db.public
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', dao.id)
    .executeTakeFirst();

  if (!daoDiscourse) return null;

  // Fetch the discourse user
  const discourseUser = await db.public
    .selectFrom('discourseUser')
    .selectAll()
    .where('externalId', '=', discourseUserId)
    .where('daoDiscourseId', '=', daoDiscourse.id)
    .executeTakeFirst();

  if (!discourseUser) return null;

  // Find the associated delegate via delegateToDiscourseUser
  const delegateToDiscourseUser = await db.public
    .selectFrom('delegateToDiscourseUser')
    .selectAll()
    .where('discourseUserId', '=', discourseUser.id)
    .executeTakeFirst();

  if (!delegateToDiscourseUser) return null;

  // Find the associated voter via delegateToVoter
  const delegateToVoter = await db.public
    .selectFrom('delegateToVoter')
    .selectAll()
    .where('delegateId', '=', delegateToDiscourseUser.delegateId)
    .executeTakeFirst();

  if (!delegateToVoter) return null;

  // Fetch the voter using the voter ID from delegateToVoter
  const voter = await db.public
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
      const proposals = await db.public
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
      const topics = await db.public
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
  let query = db.public
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

  const latestVotingPower = await db.public
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
    delegatetovoter: {
      ens: delegateData.voterEns,
      address: delegateData.voterAddress,
      latestVotingPower,
    },
  };
}

export async function getPostLikesCount(
  externalPostId: number,
  daoDiscourseId: string
) {
  // 'use cache';
  // cacheLife('minutes');

  daoDiscourseIdSchema.parse(daoDiscourseId);

  const result = await db.public
    .selectFrom('discoursePostLike')
    .select(sql<number>`count(*)`.as('count'))
    .where('externalDiscoursePostId', '=', externalPostId)
    .where('daoDiscourseId', '=', daoDiscourseId)
    .executeTakeFirst();

  return result?.count ?? 0;
}
