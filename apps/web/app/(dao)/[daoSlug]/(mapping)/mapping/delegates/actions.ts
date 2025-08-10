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

  const delegatesWithMappings = await Promise.all(
    delegates.map(async (delegate) => {
      const delegateToDiscourseUsers = await db
        .selectFrom('delegateToDiscourseUser')
        .innerJoin(
          'discourseUser',
          'discourseUser.id',
          'delegateToDiscourseUser.discourseUserId'
        )
        .where('delegateToDiscourseUser.delegateId', '=', delegate.id)
        .selectAll()
        .execute();

      let discourseUsers: Selectable<DiscourseUser>[] = [];

      if (delegateToDiscourseUsers.length) {
        discourseUsers = await db
          .selectFrom('discourseUser')
          .where(
            'discourseUser.id',
            'in',
            delegateToDiscourseUsers.map((dd) => dd.discourseUserId)
          )
          .selectAll()
          .execute();
      }

      const delegateToVoters = await db
        .selectFrom('delegateToVoter')
        .innerJoin('voter', 'voter.id', 'delegateToVoter.voterId')
        .where('delegateToVoter.delegateId', '=', delegate.id)
        .selectAll()
        .execute();

      let voters: Selectable<Voter>[] = [];

      if (delegateToVoters.length) {
        voters = await db
          .selectFrom('voter')
          .where(
            'voter.id',
            'in',
            delegateToVoters.map((dtv) => dtv.voterId)
          )
          .selectAll()
          .execute();
      }

      let latestMappingTimestamp: Date | null = null;

      if (delegateToDiscourseUsers.length > 0 || delegateToVoters.length > 0) {
        const discourseUserTimestamps = delegateToDiscourseUsers.map(
          (d) => d.periodStart
        );
        const voterTimestamps = delegateToVoters.map((v) => v.periodStart);
        const allTimestamps = [...discourseUserTimestamps, ...voterTimestamps];
        latestMappingTimestamp = new Date(
          Math.max(...allTimestamps.map((date) => date.getTime()))
        );
      }

      return {
        delegate,
        discourseUsers,
        voters,
        latestMappingTimestamp,
      };
    })
  );

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
      return -1; // if both have no mappings, keep relative order (or can be 0)
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
  searchTerm: string,
  excludeVoterIds: string[] = []
): Promise<Selectable<Voter>[]> {
  // Remove 'use cache' directive to ensure fresh results each time
  // This ensures the search functionality works properly

  // Validate inputs
  if (!searchTerm || !searchTerm.trim()) {
    console.log('Invalid search term:', { searchTerm });
    return [];
  }

  try {
    let query = db.selectFrom('voter');

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

  revalidateTag('delegatesWithMappings');
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

  revalidateTag('delegatesWithMappings');
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

  revalidateTag('delegatesWithMappings');
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

  revalidateTag('delegatesWithMappings');
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

  revalidateTag('delegatesWithMappings');
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

  revalidateTag('delegatesWithMappings');
}
