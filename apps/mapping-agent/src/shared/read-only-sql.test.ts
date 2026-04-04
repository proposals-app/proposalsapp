import { describe, expect, it, vi } from 'vitest';
import {
  buildJsonReadOnlySqlRelation,
  buildReadOnlySqlStatement,
  normalizeReadOnlySql,
} from './read-only-sql';

vi.mock('@proposalsapp/db', () => ({
  dbPool: {
    connect: vi.fn(),
  },
}));

describe('normalizeReadOnlySql', () => {
  it('accepts single select statements', () => {
    expect(
      normalizeReadOnlySql(
        'select * from current_case order by created_at desc;'
      )
    ).toBe('select * from current_case order by created_at desc');
  });

  it('rejects mutating statements', () => {
    expect(() => normalizeReadOnlySql('delete from current_case')).toThrow(
      'Read-only SQL must start with SELECT or WITH'
    );
  });
});

describe('buildJsonReadOnlySqlRelation', () => {
  it('serializes json rows into a sql relation', () => {
    const relation = buildJsonReadOnlySqlRelation({
      name: 'current_case',
      columns: [
        { name: 'proposal_id', pgType: 'text' },
        { name: 'name', pgType: 'text' },
      ],
      rows: [{ proposal_id: 'proposal-1', name: 'Proposal 1' }],
    });

    expect(relation.name).toBe('current_case');
    expect(relation.sql).toContain('jsonb_to_recordset');
    expect(relation.sql).toContain('proposal_id text');
    expect(relation.sql).toContain('Proposal 1');
  });
});

describe('buildReadOnlySqlStatement', () => {
  it('wraps the query with helper relations', () => {
    const statement = buildReadOnlySqlStatement({
      query: 'select * from current_case',
      relations: [
        {
          name: 'current_case',
          sql: 'select 1 as proposal_id',
        },
      ],
    });

    expect(statement).toContain('WITH');
    expect(statement).toContain('current_case AS');
    expect(statement).toContain('FROM (\nselect * from current_case\n)');
  });
});
