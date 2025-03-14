'use server';

import { otel } from '@/lib/otel';
import { db, DiscourseUser, Selectable, Voter } from '@proposalsapp/db-indexer';
import { revalidatePath } from 'next/cache';
import Fuse from 'fuse.js';
import { AsyncReturnType } from '@/lib/utils';

export type DelegatesWithMappingsReturnType = AsyncReturnType<
  typeof getDelegatesWithMappings
>;

export async function getDelegatesWithMappings(daoSlug: string) {
  'use server';
  return otel('get-delegates-with-mappings', async () => {
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirstOrThrow();

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

        if (
          delegateToDiscourseUsers.length > 0 ||
          delegateToVoters.length > 0
        ) {
          const discourseUserTimestamps = delegateToDiscourseUsers.map(
            (d) => d.periodStart
          );
          const voterTimestamps = delegateToVoters.map((v) => v.periodStart);
          const allTimestamps = [
            ...discourseUserTimestamps,
            ...voterTimestamps,
          ];
          latestMappingTimestamp = new Date(
            Math.max(...allTimestamps.map((date) => date.getTime()))
          );
        }

        return {
          delegate,
          discourseUsers: discourseUsers,
          voters: voters,
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
  });
}

export async function revalidateMappingPath() {
  'use server';
  revalidatePath(`/mapping/delegates-mapping`);
}

export async function fuzzySearchDiscourseUsers(
  daoSlug: string,
  searchTerm: string,
  excludeUserIds: string[] = []
): Promise<Selectable<DiscourseUser>[]> {
  if (!searchTerm.trim()) {
    return [];
  }

  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirstOrThrow();

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .selectAll()
    .executeTakeFirst();

  if (!daoDiscourse) {
    return [];
  }

  const allDiscourseUsers = await db
    .selectFrom('discourseUser')
    .where('daoDiscourseId', '=', daoDiscourse.id)
    .where('id', 'not in', excludeUserIds)
    .selectAll()
    .execute();

  const fuse = new Fuse(allDiscourseUsers, {
    keys: ['username', 'name'],
    threshold: 0.3,
  });

  return fuse.search(searchTerm).map((result) => result.item);
}

export async function fuzzySearchVoters(
  daoSlug: string,
  searchTerm: string,
  excludeVoterIds: string[] = []
): Promise<Selectable<Voter>[]> {
  if (!searchTerm.trim()) {
    return [];
  }

  const allVoters = await db
    .selectFrom('voter')
    .where('id', 'not in', excludeVoterIds)
    .selectAll()
    .limit(10)
    .execute();

  const fuse = new Fuse(allVoters, {
    keys: ['address'],
    threshold: 0.3,
  });

  return fuse.search(searchTerm).map((result) => result.item);
}

export async function mapDiscourseUserToDelegate(
  delegateId: string,
  discourseUserId: string
) {
  try {
    await db
      .insertInto('delegateToDiscourseUser')
      .values({
        delegateId,
        discourseUserId,
        periodStart: new Date(),
        periodEnd: new Date('2100-01-01'),
      })
      .execute();
    revalidateMappingPath();
  } catch (error) {
    console.error('Failed to map discourse user to delegate:', error);
    throw new Error('Failed to map discourse user to delegate');
  }
}

export async function mapVoterToDelegate(delegateId: string, voterId: string) {
  try {
    await db
      .insertInto('delegateToVoter')
      .values({
        delegateId,
        voterId,
        periodStart: new Date(),
        periodEnd: new Date('2100-01-01'),
      })
      .execute();
    revalidateMappingPath();
  } catch (error) {
    console.error('Failed to map voter to delegate:', error);
    throw new Error('Failed to map voter to delegate');
  }
}

export async function unmapDiscourseUserFromDelegate(
  delegateId: string,
  discourseUserId: string
) {
  try {
    await db
      .deleteFrom('delegateToDiscourseUser')
      .where('delegateId', '=', delegateId)
      .where('discourseUserId', '=', discourseUserId)
      .execute();
    revalidateMappingPath();
  } catch (error) {
    console.error('Failed to unmap discourse user from delegate:', error);
    throw new Error('Failed to unmap discourse user from delegate');
  }
}

export async function unmapVoterFromDelegate(
  delegateId: string,
  voterId: string
) {
  try {
    await db
      .deleteFrom('delegateToVoter')
      .where('delegateId', '=', delegateId)
      .where('voterId', '=', voterId)
      .execute();
    revalidateMappingPath();
  } catch (error) {
    console.error('Failed to unmap voter from delegate:', error);
    throw new Error('Failed to unmap voter from delegate');
  }
}

export async function createDelegate(daoSlug: string) {
  try {
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirstOrThrow();

    await db
      .insertInto('delegate')
      .values({
        daoId: dao.id,
      })
      .execute();
    revalidateMappingPath();
  } catch (error) {
    console.error('Failed to create delegate:', error);
    throw new Error('Failed to create delegate');
  }
}

export async function deleteDelegate(delegateId: string) {
  try {
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

    revalidateMappingPath();
  } catch (error) {
    console.error('Failed to delete delegate:', error);
    throw new Error('Failed to delete delegate');
  }
}
