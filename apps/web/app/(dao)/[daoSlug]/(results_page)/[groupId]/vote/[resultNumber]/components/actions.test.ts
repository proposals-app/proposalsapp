import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVotesWithVoters } from './actions';

// Postgres rejects statements with more bind parameters than fit in the
// protocol's 16-bit counter. The fake pg client below enforces the same limit
// so a regression surfaces here instead of as a production 500.
const POSTGRES_MAX_BIND_PARAMETERS = 65_535;

// `@proposalsapp/db` reuses `globalThis.dbPoolInternal` outside production, so
// seeding it before the module loads makes the real Kysely instance talk to
// this fake pg pool instead of a database.
const fakeDb = vi.hoisted(() => {
  const POSTGRES_MAX_BIND_PARAMETERS = 65_535;
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/test';

  type Row = Record<string, unknown>;
  const state = {
    handler: (_sql: string, _params: unknown[]): Row[] => [],
    parameterCounts: [] as number[],
  };

  const client = {
    processID: 1,
    release: () => undefined,
    query: async (sql: string, params: unknown[] = []) => {
      state.parameterCounts.push(params.length);
      if (params.length > POSTGRES_MAX_BIND_PARAMETERS) {
        throw new Error(
          `bind message has ${params.length % 65_536} parameter formats but 0 parameters`
        );
      }
      return {
        command: 'SELECT',
        rowCount: 0,
        rows: state.handler(sql, params),
      };
    },
  };

  const globals = globalThis as Record<string, unknown>;
  delete globals.dbInternal;
  globals.dbPoolInternal = {
    options: {},
    connect: async () => client,
    end: async () => undefined,
  };

  return { state };
});

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const DAO_ID = '22222222-2222-4222-8222-222222222222';
const DAO_DISCOURSE_ID = '33333333-3333-4333-8333-333333333333';

function idsWithPrefix(params: unknown[], prefix: string): string[] {
  return params.filter(
    (param): param is string =>
      typeof param === 'string' && param.startsWith(prefix)
  );
}

describe('getVotesWithVoters', () => {
  beforeEach(() => {
    fakeDb.state.parameterCounts.length = 0;
  });

  it('loads voter profiles for proposals with more votes than Postgres bind parameters', async () => {
    const voteCount = 70_000;

    fakeDb.state.handler = (sql, params) => {
      if (sql.includes('from "proposal"')) {
        return [{ id: PROPOSAL_ID, dao_id: DAO_ID }];
      }
      if (sql.includes('from "vote"')) {
        return Array.from({ length: voteCount }, (_, index) => ({
          id: `vote-${index}`,
          choice: 0,
          created_at: new Date('2026-10-01T00:00:00.000Z'),
          proposal_id: PROPOSAL_ID,
          reason: null,
          voter_address: `0x${index.toString(16).padStart(40, '0')}`,
          voting_power: 1,
          voter_id: `voter-${index}`,
          ens: null,
          avatar: null,
          latest_voting_power: 1,
        }));
      }
      if (sql.includes('from "delegate_to_voter"')) {
        return idsWithPrefix(params, 'voter-').map((voterId) => ({
          voter_id: voterId,
          delegate_id: voterId.replace('voter-', 'delegate-'),
        }));
      }
      if (sql.includes('from "dao_discourse"')) {
        return [{ id: DAO_DISCOURSE_ID }];
      }
      if (sql.includes('from "delegate_to_discourse_user"')) {
        return idsWithPrefix(params, 'delegate-').map((delegateId) => ({
          delegate_id: delegateId,
          discourse_user_id: delegateId.replace('delegate-', 'du-'),
        }));
      }
      if (sql.includes('from "discourse_user"')) {
        return idsWithPrefix(params, 'du-').map((id) => ({
          id,
          username: `user-${id.slice('du-'.length)}`,
          avatar_template: null,
          dao_discourse_id: DAO_DISCOURSE_ID,
        }));
      }
      throw new Error(`Unexpected query: ${sql}`);
    };

    const votes = await getVotesWithVoters(PROPOSAL_ID);

    expect(votes).toHaveLength(voteCount);
    expect(votes[0].discourseUsername).toBe('user-0');
    expect(votes.at(-1)?.discourseUsername).toBe(`user-${voteCount - 1}`);
    expect(Math.max(...fakeDb.state.parameterCounts)).toBeLessThan(
      POSTGRES_MAX_BIND_PARAMETERS
    );
  });
});
