import { db } from '@proposalsapp/db';
import Fuse from 'fuse.js';
import type { AsyncReturnType } from '@/lib/utils';
import { revalidateTag } from 'next/cache';
import { requireDao } from '@/lib/server-actions-utils';
import { daoIdSchema } from '@/lib/validations';
import type { DiscourseUserSummary, VoterSummary } from '../api-contract';

export type DelegatesWithMappingsReturnType = AsyncReturnType<
  typeof getDelegatesWithMappings
>;

export async function getDelegatesWithMappings(daoSlug: string) {
  // 'use cache';
  // cacheTag('delegatesWithMappings');

  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return [];

  const delegates = await db
    .selectFrom('delegate')
    .where('daoId', '=', dao.id)
    .selectAll()
    .execute();

  if (delegates.length === 0) return [];

  const delegateIds = delegates.map((delegate) => delegate.id);

  const [delegateToDiscourseUsers, delegateToVoters] = await Promise.all([
    db
      .selectFrom('delegateToDiscourseUser')
      .where('delegateId', 'in', delegateIds)
      .select(['delegateId', 'discourseUserId', 'periodStart'])
      .execute(),
    db
      .selectFrom('delegateToVoter')
      .where('delegateId', 'in', delegateIds)
      .select(['delegateId', 'voterId', 'periodStart'])
      .execute(),
  ]);

  const discourseUserIds = [
    ...new Set(
      delegateToDiscourseUsers.map((mapping) => mapping.discourseUserId)
    ),
  ];
  const voterIds = [
    ...new Set(delegateToVoters.map((mapping) => mapping.voterId)),
  ];

  const [discourseUsers, voters] = await Promise.all([
    discourseUserIds.length > 0
      ? db
          .selectFrom('discourseUser')
          .where('id', 'in', discourseUserIds)
          .select(['id', 'username', 'name'])
          .execute()
      : Promise.resolve([] as DiscourseUserSummary[]),
    voterIds.length > 0
      ? db
          .selectFrom('voter')
          .where('id', 'in', voterIds)
          .select(['id', 'address', 'ens'])
          .execute()
      : Promise.resolve([] as VoterSummary[]),
  ]);

  const discourseUserById = new Map(
    discourseUsers.map((user) => [user.id, user])
  );
  const voterById = new Map(voters.map((voter) => [voter.id, voter]));

  const discourseMappingsByDelegate = new Map<
    string,
    Array<{ discourseUserId: string; periodStart: Date }>
  >();
  for (const mapping of delegateToDiscourseUsers) {
    const rows = discourseMappingsByDelegate.get(mapping.delegateId) ?? [];
    rows.push({
      discourseUserId: mapping.discourseUserId,
      periodStart: mapping.periodStart,
    });
    discourseMappingsByDelegate.set(mapping.delegateId, rows);
  }

  const voterMappingsByDelegate = new Map<
    string,
    Array<{ voterId: string; periodStart: Date }>
  >();
  for (const mapping of delegateToVoters) {
    const rows = voterMappingsByDelegate.get(mapping.delegateId) ?? [];
    rows.push({
      voterId: mapping.voterId,
      periodStart: mapping.periodStart,
    });
    voterMappingsByDelegate.set(mapping.delegateId, rows);
  }

  const delegatesWithMappings = delegates.map((delegate) => {
    const discourseMappings =
      discourseMappingsByDelegate.get(delegate.id) ?? [];
    const voterMappings = voterMappingsByDelegate.get(delegate.id) ?? [];

    const mappedDiscourseUsers = discourseMappings
      .map((mapping) => discourseUserById.get(mapping.discourseUserId))
      .filter((user): user is DiscourseUserSummary => Boolean(user));

    const mappedVoters = voterMappings
      .map((mapping) => voterById.get(mapping.voterId))
      .filter((voter): voter is VoterSummary => Boolean(voter));

    const timestamps = [
      ...discourseMappings.map((mapping) => mapping.periodStart),
      ...voterMappings.map((mapping) => mapping.periodStart),
    ];
    const latestMappingTimestamp =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((date) => date.getTime())))
        : null;

    return {
      delegate,
      discourseUsers: mappedDiscourseUsers,
      voters: mappedVoters,
      latestMappingTimestamp,
    };
  });

  delegatesWithMappings.sort((a, b) => {
    const hasMappingsA = a.discourseUsers.length > 0 || a.voters.length > 0;
    const hasMappingsB = b.discourseUsers.length > 0 || b.voters.length > 0;

    if (!hasMappingsA && hasMappingsB) {
      return -1; // a comes before b (a has no mappings)
    }
    if (hasMappingsA && !hasMappingsB) {
      return 1; // b comes before a (b has no mappings)
    }
    if (!hasMappingsA && !hasMappingsB) {
      return 0; // keep original order when both have no mappings
    }

    // Both have mappings, sort by latestMappingTimestamp
    const timestampA = a.latestMappingTimestamp
      ? a.latestMappingTimestamp.getTime()
      : -Infinity; // Should not happen as hasMappingsA is true
    const timestampB = b.latestMappingTimestamp
      ? b.latestMappingTimestamp.getTime()
      : -Infinity; // Should not happen as hasMappingsB is true
    return timestampB - timestampA; // Sort in descending order (newest first)
  });

  return delegatesWithMappings;
}

export async function fuzzySearchDiscourseUsers(
  daoSlug: string,
  searchTerm: string,
  excludeUserIds: string[] = []
): Promise<DiscourseUserSummary[]> {
  const dao = await requireDao(daoSlug);
  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .select('id')
    .executeTakeFirst();

  if (!daoDiscourse) return [];

  let query = db
    .selectFrom('discourseUser')
    .where('daoDiscourseId', '=', daoDiscourse.id);

  if (excludeUserIds.length > 0) {
    query = query.where('id', 'not in', excludeUserIds);
  }

  const users = await query.select(['id', 'username', 'name']).execute();
  const fuse = new Fuse(users, {
    keys: ['username', 'name'],
    threshold: 0.3,
  });

  return fuse
    .search(searchTerm)
    .slice(0, 100)
    .map((result) => result.item);
}

export async function fuzzySearchVoters(
  daoSlug: string,
  searchTerm: string,
  excludeVoterIds: string[] = []
): Promise<VoterSummary[]> {
  const dao = await requireDao(daoSlug);

  // Voters are global records; scope the search to addresses with DAO activity.
  let query = db
    .selectFrom('voter')
    .where((eb) =>
      eb.or([
        eb(
          'address',
          'in',
          db
            .selectFrom('votingPowerTimeseries as vp')
            .select('vp.voter')
            .where('vp.daoId', '=', dao.id)
        ),
        eb(
          'address',
          'in',
          db
            .selectFrom('vote as vo')
            .select('vo.voterAddress')
            .where('vo.daoId', '=', dao.id)
        ),
      ])
    );

  if (excludeVoterIds.length > 0) {
    query = query.where('id', 'not in', excludeVoterIds);
  }

  const voters = await query.select(['id', 'address', 'ens']).execute();
  const fuse = new Fuse(voters, {
    keys: ['address', 'ens'],
    threshold: 0.3,
  });

  return fuse
    .search(searchTerm)
    .slice(0, 100)
    .map((result) => result.item);
}

export async function mapDiscourseUserToDelegate(
  daoSlug: string,
  delegateId: string,
  discourseUserId: string
) {
  daoIdSchema.parse(delegateId);
  daoIdSchema.parse(discourseUserId);
  const dao = await requireDao(daoSlug);
  await assertDelegateBelongsToDao(delegateId, dao.id);

  const discourseUser = await db
    .selectFrom('discourseUser as du')
    .innerJoin('daoDiscourse as dd', 'dd.id', 'du.daoDiscourseId')
    .select('du.id')
    .where('du.id', '=', discourseUserId)
    .where('dd.daoId', '=', dao.id)
    .executeTakeFirst();

  if (!discourseUser) {
    throw new Error('Discourse user does not belong to this DAO');
  }

  await db
    .insertInto('delegateToDiscourseUser')
    .values({
      delegateId,
      discourseUserId,
      periodStart: new Date(),
      periodEnd: new Date('2100-01-01'),
    })
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function mapVoterToDelegate(
  daoSlug: string,
  delegateId: string,
  voterId: string
) {
  daoIdSchema.parse(delegateId);
  daoIdSchema.parse(voterId);
  const dao = await requireDao(daoSlug);
  await assertDelegateBelongsToDao(delegateId, dao.id);

  await db
    .insertInto('delegateToVoter')
    .values({
      delegateId,
      voterId,
      periodStart: new Date(),
      periodEnd: new Date('2100-01-01'),
    })
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function unmapDiscourseUserFromDelegate(
  daoSlug: string,
  delegateId: string,
  discourseUserId: string
) {
  daoIdSchema.parse(delegateId);
  daoIdSchema.parse(discourseUserId);
  const dao = await requireDao(daoSlug);
  await assertDelegateBelongsToDao(delegateId, dao.id);

  await db
    .deleteFrom('delegateToDiscourseUser')
    .where('delegateId', '=', delegateId)
    .where('discourseUserId', '=', discourseUserId)
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function unmapVoterFromDelegate(
  daoSlug: string,
  delegateId: string,
  voterId: string
) {
  daoIdSchema.parse(delegateId);
  daoIdSchema.parse(voterId);
  const dao = await requireDao(daoSlug);
  await assertDelegateBelongsToDao(delegateId, dao.id);

  await db
    .deleteFrom('delegateToVoter')
    .where('delegateId', '=', delegateId)
    .where('voterId', '=', voterId)
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function createDelegate(daoSlug: string) {
  const dao = await requireDao(daoSlug);

  await db
    .insertInto('delegate')
    .values({
      daoId: dao.id,
    })
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function deleteDelegate(daoSlug: string, delegateId: string) {
  daoIdSchema.parse(delegateId);
  const dao = await requireDao(daoSlug);
  await assertDelegateBelongsToDao(delegateId, dao.id);

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('delegateToDiscourseUser')
      .where('delegateId', '=', delegateId)
      .execute();

    await trx
      .deleteFrom('delegateToVoter')
      .where('delegateId', '=', delegateId)
      .execute();

    await trx.deleteFrom('delegate').where('id', '=', delegateId).execute();
  });

  revalidateTag('delegatesWithMappings', 'max');
}

async function assertDelegateBelongsToDao(
  delegateId: string,
  daoId: string
): Promise<void> {
  const delegate = await db
    .selectFrom('delegate')
    .select('id')
    .where('id', '=', delegateId)
    .where('daoId', '=', daoId)
    .executeTakeFirst();

  if (!delegate) {
    throw new Error('Delegate does not belong to this DAO');
  }
}
