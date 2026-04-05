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

describe('filterRetryableDelegateCases', () => {
  it('skips delegate cases that were previously marked as terminal no-match', async () => {
    process.env.DATABASE_URL ??=
      'postgresql://build:build@localhost:5432/build';
    const { filterRetryableDelegateCases } = await import('./repository');

    const filteredCases = filterRetryableDelegateCases(
      [
        {
          delegateId: 'delegate-voter',
          missingSide: 'voter',
          sourceDiscourseUserId: 'discourse-1',
        },
        {
          delegateId: 'delegate-discourse',
          missingSide: 'discourse_user',
          sourceVoterId: 'voter-1',
        },
      ],
      [
        {
          delegateId: 'delegate-voter',
          missingSide: 'voter',
        },
      ]
    );

    expect(filteredCases).toEqual([
      {
        delegateId: 'delegate-discourse',
        missingSide: 'discourse_user',
        sourceVoterId: 'voter-1',
      },
    ]);
  });
});

describe('resolveDelegateVoterTarget', () => {
  it('resolves voter targets by exact UUID, address, or ENS', async () => {
    process.env.DATABASE_URL ??=
      'postgresql://build:build@localhost:5432/build';
    const { resolveDelegateVoterTarget } = await import('./repository');

    const voters = [
      {
        id: 'aacc028a-01c4-4bb7-9145-ce43ce6ec740',
        daoId: 'dao-1',
        address: '0xa6e8772af29b29B9202a073f8E36f447689BEef6',
        ens: 'gfxlabs.eth',
      },
    ];

    expect(
      resolveDelegateVoterTarget({
        targetId: 'aacc028a-01c4-4bb7-9145-ce43ce6ec740',
        voters,
      })
    ).toEqual(voters[0]);
    expect(
      resolveDelegateVoterTarget({
        targetId: '0xa6e8772af29b29b9202a073f8e36f447689beef6',
        voters,
      })
    ).toEqual(voters[0]);
    expect(
      resolveDelegateVoterTarget({
        targetId: 'gfxlabs.eth',
        voters,
      })
    ).toEqual(voters[0]);
  });

  it('returns a contract error for unknown voter target identifiers', async () => {
    process.env.DATABASE_URL ??=
      'postgresql://build:build@localhost:5432/build';
    const { resolveDelegateVoterTarget } = await import('./repository');

    expect(() =>
      resolveDelegateVoterTarget({
        targetId: 'not-a-real-target',
        voters: [],
      })
    ).toThrow(
      'For mappingType=delegate_to_voter, targetId must be the exact voters.id UUID, voters.address, or voters.ens copied verbatim from a queried row in this case.'
    );
  });

  it('does not describe missing voter identifiers as a same-dao failure', async () => {
    process.env.DATABASE_URL ??=
      'postgresql://build:build@localhost:5432/build';
    const { resolveDelegateVoterTarget } = await import('./repository');

    expect(() =>
      resolveDelegateVoterTarget({
        targetId: 'rndao.eth',
        voters: [],
      })
    ).toThrow('No voter matched ENS rndao.eth.');

    expect(() =>
      resolveDelegateVoterTarget({
        targetId: '7cf42c2e-adf2-44e7-b0a3-82ac83107fc1',
        voters: [],
      })
    ).toThrow('No voter matched UUID 7cf42c2e-adf2-44e7-b0a3-82ac83107fc1.');
  });
});
