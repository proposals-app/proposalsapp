import type { Kysely } from 'kysely';
import type { DB } from '../src';

export async function seed(db: Kysely<DB>): Promise<void> {
  await db
    .insertInto('dao')
    .values({
      name: 'Arbitrum',
      slug: 'arbitrum',
      picture: 'assets/project-logos/arbitrum',
    })
    .execute();

  const arbitrumDao = await db
    .selectFrom('dao')
    .where('slug', '=', 'arbitrum')
    .selectAll()
    .executeTakeFirstOrThrow();

  await db
    .insertInto('daoDiscourse')
    .values({
      daoId: arbitrumDao.id,
      discourseBaseUrl: 'https://forum.arbitrum.foundation',
      enabled: true,
      withUserAgent: false,
    })
    .execute();

  await db
    .insertInto('daoGovernor')
    .values([
      {
        daoId: arbitrumDao.id,
        name: 'Snapshot',
        type: 'ARBITRUM_SNAPSHOT',
        metadata: {},
        enabled: true,
        portalUrl: 'https://snapshot.org/#/arbitrumfoundation.eth',
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Core Proposal',
        type: 'ARBITRUM_CORE',
        metadata: {},
        enabled: true,
        portalUrl: 'https://www.tally.xyz/gov/arbitrum',
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Treasury Proposal',
        type: 'ARBITRUM_TREASURY',
        metadata: {},
        enabled: true,
        portalUrl: 'https://www.tally.xyz/gov/arbitrum',
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Security Council Nominations',
        type: 'ARBITRUM_SC_NOMINATIONS',
        metadata: {},
        enabled: true,
      },
      {
        daoId: arbitrumDao.id,
        name: 'Arbitrum Security Council Elections',
        type: 'ARBITRUM_SC_ELECTIONS',
        metadata: {},
        enabled: true,
        portalUrl: 'https://snapshot.org/#/arbitrumfoundation.eth',
      },
    ])
    .execute();
}
