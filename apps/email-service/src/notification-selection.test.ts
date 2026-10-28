import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alreadySentCutoff,
  DEFAULT_NEW_ITEM_LOOKBACK_HOURS,
  findNewDiscussionTopics,
  findNewProposals,
  hasAlreadySent,
  newItemWindowStart,
  parseLookbackHours,
} from './notification-selection';

// `@proposalsapp/db` reuses `globalThis.dbPoolInternal` outside production, so
// seeding it before the module loads routes the real Kysely instance to this
// fake pg pool, letting the tests inspect the SQL and parameters it sends.
const fakeDb = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/test';
  delete process.env.NEW_ITEM_LOOKBACK_HOURS;

  const state = {
    queries: [] as Array<{ sql: string; params: unknown[] }>,
    rows: [] as Record<string, unknown>[],
  };
  const client = {
    processID: 1,
    release: () => undefined,
    query: async (sql: string, params: unknown[] = []) => {
      state.queries.push({ sql, params });
      return { command: 'SELECT', rowCount: 0, rows: state.rows };
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

const NOW = new Date('2026-10-23T12:00:00.000Z');
const DAY_AGO = new Date('2026-10-22T12:00:00.000Z');

function lastQuery() {
  const query = fakeDb.state.queries.at(-1);
  if (!query) throw new Error('No query was executed');
  return query;
}

/** Returns the bound value compared against `column` with `operator`. */
function boundValue(
  query: { sql: string; params: unknown[] },
  column: string,
  operator: string
): unknown {
  const escapedOperator = operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = query.sql.match(
    new RegExp(`${column} ${escapedOperator} \\$(\\d+)`)
  );
  if (!match) {
    throw new Error(`No "${column} ${operator}" filter in: ${query.sql}`);
  }
  return query.params[Number(match[1]) - 1];
}

beforeEach(() => {
  fakeDb.state.queries.length = 0;
  fakeDb.state.rows = [];
});

describe('parseLookbackHours', () => {
  it('defaults to 24 hours', () => {
    expect(DEFAULT_NEW_ITEM_LOOKBACK_HOURS).toBe(24);
    expect(parseLookbackHours(undefined)).toBe(24);
    expect(parseLookbackHours('')).toBe(24);
  });

  it('accepts positive overrides and ignores invalid ones', () => {
    expect(parseLookbackHours('6')).toBe(6);
    expect(parseLookbackHours('0.5')).toBe(0.5);
    expect(parseLookbackHours('0')).toBe(24);
    expect(parseLookbackHours('-3')).toBe(24);
    expect(parseLookbackHours('soon')).toBe(24);
  });
});

describe('newItemWindowStart', () => {
  it('looks back the configured number of hours', () => {
    expect(newItemWindowStart(NOW)).toEqual(DAY_AGO);
    expect(newItemWindowStart(NOW, 1)).toEqual(
      new Date('2026-10-23T11:00:00.000Z')
    );
  });
});

describe('findNewProposals', () => {
  it('selects active, non-spam proposals whose voting started in the last 24h', async () => {
    await findNewProposals('dao-1', NOW);

    const query = lastQuery();
    expect(boundValue(query, '"start_at"', '>=')).toEqual(DAY_AGO);
    expect(boundValue(query, '"dao_id"', '=')).toBe('dao-1');
    expect(boundValue(query, '"proposal_state"', '=')).toBe('ACTIVE');
    expect(boundValue(query, '"marked_spam"', '=')).toBe(false);
    // Creation time is irrelevant: Snapshot and on-chain proposals often open
    // for voting minutes to days after they are created.
    expect(query.sql).not.toContain('"created_at"');
  });
});

describe('findNewDiscussionTopics', () => {
  it('selects topics created in the last 24h in the allowed categories', async () => {
    await findNewDiscussionTopics({
      daoDiscourseId: 'discourse-1',
      allowedCategories: [7, 8, 9],
      now: NOW,
    });

    const query = lastQuery();
    expect(boundValue(query, '"discourse_topic"."created_at"', '>=')).toEqual(
      DAY_AGO
    );
    expect(boundValue(query, '"discourse_topic"."dao_discourse_id"', '=')).toBe(
      'discourse-1'
    );
    expect(query.sql).toContain('"discourse_topic"."category_id" in ($');
    expect(query.params).toEqual(expect.arrayContaining([7, 8, 9]));
  });

  it('does not filter by category when none are configured', async () => {
    await findNewDiscussionTopics({
      daoDiscourseId: 'discourse-1',
      allowedCategories: undefined,
      now: NOW,
    });

    expect(lastQuery().sql).not.toContain('"category_id"');
  });
});

describe('alreadySentCutoff', () => {
  it('treats any previous new-proposal or new-discussion send as sent', () => {
    expect(alreadySentCutoff('new_proposal', NOW)).toBeUndefined();
    expect(alreadySentCutoff('new_discussion', NOW)).toBeUndefined();
  });

  it('keeps the 24h cooldown for ending-proposal reminders', () => {
    expect(alreadySentCutoff('ending_proposal', NOW)).toEqual(DAY_AGO);
  });
});

describe('hasAlreadySent', () => {
  const input = {
    userId: 'user-1',
    targetId: 'proposal-1',
    daoId: 'dao-1',
    now: NOW,
  };

  it.each(['new_proposal', 'new_discussion'] as const)(
    'matches %s sends of any age',
    async (type) => {
      fakeDb.state.rows = [{ id: 'notification-1' }];

      await expect(hasAlreadySent({ ...input, type })).resolves.toBe(true);

      const query = lastQuery();
      expect(boundValue(query, '"type"', '=')).toBe(type);
      expect(boundValue(query, '"user_id"', '=')).toBe('user-1');
      expect(boundValue(query, '"target_id"', '=')).toBe('proposal-1');
      expect(query.sql).not.toContain('"sent_at"');
    }
  );

  it('only matches ending-proposal sends inside the cooldown', async () => {
    await expect(
      hasAlreadySent({ ...input, type: 'ending_proposal' })
    ).resolves.toBe(false);

    expect(boundValue(lastQuery(), '"sent_at"', '>=')).toEqual(DAY_AGO);
  });
});
