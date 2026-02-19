'use server';

import {
  db,
  type DiscourseUser,
  type Selectable,
  type Voter,
} from '@proposalsapp/db';
import Fuse from 'fuse.js';
import type { AsyncReturnType } from '@/lib/utils';
import { revalidateTag } from 'next/cache';

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
          .selectAll()
          .execute()
      : Promise.resolve([] as Selectable<DiscourseUser>[]),
    voterIds.length > 0
      ? db.selectFrom('voter').where('id', 'in', voterIds).selectAll().execute()
      : Promise.resolve([] as Selectable<Voter>[]),
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
      .filter((user): user is Selectable<DiscourseUser> => Boolean(user));

    const mappedVoters = voterMappings
      .map((mapping) => voterById.get(mapping.voterId))
      .filter((voter): voter is Selectable<Voter> => Boolean(voter));

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
): Promise<Selectable<DiscourseUser>[]> {
  // Remove 'use cache' directive to ensure fresh results each time
  // This ensures the search functionality works properly

  // Validate inputs
  if (!searchTerm || !searchTerm.trim() || !daoSlug) {
    console.log('Invalid search term or daoSlug:', { searchTerm, daoSlug });
    return [];
  }

  try {
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) {
      console.error(`DAO not found: ${daoSlug}`);
      return [];
    }

    const daoDiscourse = await db
      .selectFrom('daoDiscourse')
      .where('daoId', '=', dao.id)
      .selectAll()
      .executeTakeFirst();

    if (!daoDiscourse) {
      console.log('No daoDiscourse found for dao:', daoSlug);
      return [];
    }

    let query = db
      .selectFrom('discourseUser')
      .where('daoDiscourseId', '=', daoDiscourse.id);

    if (excludeUserIds.length > 0) {
      query = query.where('id', 'not in', excludeUserIds);
    }

    const allDiscourseUsers = await query.selectAll().execute();
    console.log(`Found ${allDiscourseUsers.length} discourse users for search`);

    if (allDiscourseUsers.length === 0) {
      return [];
    }

    const fuse = new Fuse(allDiscourseUsers, {
      keys: ['username', 'name'],
      threshold: 0.3,
    });

    const results = fuse.search(searchTerm).map((result) => result.item);
    console.log(
      `Search for "${searchTerm}" returned ${results.length} results`
    );
    return results;
  } catch (error) {
    console.error('Error in fuzzySearchDiscourseUsers:', error);
    return [];
  }
}

export async function fuzzySearchVoters(
  daoSlug: string,
  searchTerm: string,
  excludeVoterIds: string[] = []
): Promise<Selectable<Voter>[]> {
  // Remove 'use cache' directive to ensure fresh results each time
  // This ensures the search functionality works properly

  // Validate inputs
  if (!searchTerm || !searchTerm.trim() || !daoSlug) {
    console.log('Invalid search term or daoSlug:', { searchTerm, daoSlug });
    return [];
  }

  try {
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) {
      console.error(`DAO not found: ${daoSlug}`);
      return [];
    }

    // Limit voters to those relevant to the DAO by checking membership via IN subqueries
    // (easier to type correctly than cross-scope whereRef conditions)
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

    const allVoters = await query.selectAll().execute();
    console.log(`Found ${allVoters.length} voters for search`);

    if (allVoters.length === 0) {
      return [];
    }

    const fuse = new Fuse(allVoters, {
      keys: ['address', 'ens'],
      threshold: 0.3,
    });

    const results = fuse.search(searchTerm).map((result) => result.item);
    console.log(
      `Search for "${searchTerm}" returned ${results.length} results`
    );
    return results;
  } catch (error) {
    console.error('Error in fuzzySearchVoters:', error);
    return [];
  }
}

export async function mapDiscourseUserToDelegate(
  delegateId: string,
  discourseUserId: string
) {
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

export async function mapVoterToDelegate(delegateId: string, voterId: string) {
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
  delegateId: string,
  discourseUserId: string
) {
  await db
    .deleteFrom('delegateToDiscourseUser')
    .where('delegateId', '=', delegateId)
    .where('discourseUserId', '=', discourseUserId)
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function unmapVoterFromDelegate(
  delegateId: string,
  voterId: string
) {
  await db
    .deleteFrom('delegateToVoter')
    .where('delegateId', '=', delegateId)
    .where('voterId', '=', voterId)
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function createDelegate(daoSlug: string) {
  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    console.error(`DAO not found: ${daoSlug}`);
    return;
  }

  await db
    .insertInto('delegate')
    .values({
      daoId: dao.id,
    })
    .execute();

  revalidateTag('delegatesWithMappings', 'max');
}

export async function deleteDelegate(delegateId: string) {
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
