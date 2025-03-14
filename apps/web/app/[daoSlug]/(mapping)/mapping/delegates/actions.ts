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
        const delegateToDiscourseUser = await db
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

        if (delegateToDiscourseUser.length)
          discourseUsers = await db
            .selectFrom('discourseUser')
            .where(
              'discourseUser.id',
              'in',
              delegateToDiscourseUser.map((dd) => dd.discourseUserId)
            )
            .selectAll()
            .execute();

        const delegateToVoter = await db
          .selectFrom('delegateToVoter')
          .innerJoin('voter', 'voter.id', 'delegateToVoter.voterId')
          .where('delegateToVoter.delegateId', '=', delegate.id)
          .selectAll()
          .execute();

        let voters: Selectable<Voter>[] = [];

        if (delegateToVoter.length)
          voters = await db
            .selectFrom('voter')
            .where(
              'voter.id',
              'in',
              delegateToVoter.map((dtv) => dtv.voterId)
            )
            .selectAll()
            .execute();

        return {
          delegate,
          discourseUsers: discourseUsers,
          voters: voters,
        };
      })
    );

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
    return []; // No discourse configured for this DAO
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
