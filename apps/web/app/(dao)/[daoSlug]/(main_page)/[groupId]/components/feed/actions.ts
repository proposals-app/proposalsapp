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

  const discourseUser = await db
    .selectFrom('discourseUser')
    .selectAll()
    .where('daoDiscourseId', '=', daoDiscourseId)
    .where('externalId', '=', userId)
    .executeTakeFirst();

  return discourseUser;
}

export async function getDelegateByDiscourseUser(
  discourseUserId: number,
  daoSlug: string
) {
  discourseUserIdSchema.parse(discourseUserId);
  daoSlugSchema.parse(daoSlug);

  const delegateData = await db
    .selectFrom('discourseUser as du')
    .innerJoin('daoDiscourse as dd', 'dd.id', 'du.daoDiscourseId')
    .innerJoin('dao as dao', 'dao.id', 'dd.daoId')
    .innerJoin(
      'delegateToDiscourseUser as dtdu',
      'dtdu.discourseUserId',
      'du.id'
    )
    .innerJoin('delegate as d', (join) =>
      join.onRef('d.id', '=', 'dtdu.delegateId').onRef('d.daoId', '=', 'dao.id')
    )
    .innerJoin('delegateToVoter as dtv', 'dtv.delegateId', 'd.id')
    .innerJoin('voter as v', 'v.id', 'dtv.voterId')
    .leftJoin('votingPowerLatest as vpl', (join) =>
      join
        .onRef('vpl.voter', '=', 'v.address')
        .onRef('vpl.daoId', '=', 'dao.id')
    )
    .where('du.externalId', '=', discourseUserId)
    .where('dao.slug', '=', daoSlug)
    .select([
      'd.id as delegateId',
      'du.name as discourseName',
      'du.username as discourseUsername',
      'du.avatarTemplate as discourseAvatarTemplate',
      'v.ens as voterEns',
      'v.address as voterAddress',
      'vpl.block as latestVotingPowerBlock',
      'vpl.daoId as latestVotingPowerDaoId',
      'vpl.id as latestVotingPowerId',
      'vpl.timestamp as latestVotingPowerTimestamp',
      'vpl.txid as latestVotingPowerTxid',
      'vpl.voter as latestVotingPowerVoter',
      'vpl.votingPower as latestVotingPowerValue',
    ])
    .orderBy('dtdu.createdAt', 'desc')
    .orderBy('dtv.createdAt', 'desc')
    .executeTakeFirst();

  if (!delegateData) return null;

  const latestVotingPower = delegateData.latestVotingPowerId
    ? {
        block: delegateData.latestVotingPowerBlock!,
        daoId: delegateData.latestVotingPowerDaoId!,
        id: delegateData.latestVotingPowerId,
        timestamp: delegateData.latestVotingPowerTimestamp!,
        txid: delegateData.latestVotingPowerTxid,
        voter: delegateData.latestVotingPowerVoter!,
        votingPower: delegateData.latestVotingPowerValue!,
      }
    : undefined;

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

export async function getDelegateVotingPowerByDiscourseUserIds(
  discourseUserIds: number[],
  daoSlug: string
): Promise<Map<number, number>> {
  daoSlugSchema.parse(daoSlug);
  const uniqueIds = [...new Set(discourseUserIds)];
  uniqueIds.forEach((id) => discourseUserIdSchema.parse(id));
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .selectFrom('discourseUser as du')
    .innerJoin('daoDiscourse as dd', 'dd.id', 'du.daoDiscourseId')
    .innerJoin('dao as dao', 'dao.id', 'dd.daoId')
    .leftJoin(
      'delegateToDiscourseUser as dtdu',
      'dtdu.discourseUserId',
      'du.id'
    )
    .leftJoin('delegate as d', (join) =>
      join.onRef('d.id', '=', 'dtdu.delegateId').onRef('d.daoId', '=', 'dao.id')
    )
    .leftJoin('delegateToVoter as dtv', 'dtv.delegateId', 'd.id')
    .leftJoin('voter as v', 'v.id', 'dtv.voterId')
    .leftJoin('votingPowerLatest as vpl', (join) =>
      join
        .onRef('vpl.voter', '=', 'v.address')
        .onRef('vpl.daoId', '=', 'dao.id')
    )
    .where('dao.slug', '=', daoSlug)
    .where('du.externalId', 'in', uniqueIds)
    .distinctOn('du.externalId')
    .select(['du.externalId', 'vpl.votingPower'])
    .orderBy('du.externalId', 'asc')
    .orderBy('dtdu.createdAt', 'desc')
    .orderBy('dtv.createdAt', 'desc')
    .execute();

  return new Map(
    rows.map((row) => [row.externalId, row.votingPower ?? 0] as const)
  );
}

export async function getPostLikesCount(
  externalPostId: number,
  daoDiscourseId: string
) {
  // 'use cache';
  // cacheLife('minutes');

  daoDiscourseIdSchema.parse(daoDiscourseId);

  const result = await db
    .selectFrom('discoursePostLike')
    .select(sql<number>`count(*)`.as('count'))
    .where('externalDiscoursePostId', '=', externalPostId)
    .where('daoDiscourseId', '=', daoDiscourseId)
    .executeTakeFirst();

  return result?.count ?? 0;
}
