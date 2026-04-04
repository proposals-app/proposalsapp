import { describe, expect, it } from 'vitest';

describe('buildRelevantVoterLookupSql', () => {
  it('uses latest voting power rows plus vote rows and joins back to voter', async () => {
    process.env.DATABASE_URL ??=
      'postgresql://build:build@localhost:5432/build';
    const { buildRelevantVoterLookupSql } = await import('./repository');

    const sql = buildRelevantVoterLookupSql(
      'f4b728d7-8117-4756-85d6-ca1a95412eaa'
    );

    expect(sql).toContain('FROM voter v');
    expect(sql).toContain('FROM voting_power_latest');
    expect(sql).toContain('SELECT voter AS address');
    expect(sql).toContain('UNION');
    expect(sql).toContain('SELECT voter_address AS address');
    expect(sql).toContain('FROM vote');
    expect(sql).toContain('ON relevant_addresses.address = v.address');
  });
});
