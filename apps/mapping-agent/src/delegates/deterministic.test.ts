import { describe, expect, it } from 'vitest';
import {
  buildDiscourseSeedCandidates,
  buildDelegateCases,
  rankDiscourseUserCandidates,
  rankVoterCandidates,
  type DelegateCase,
  type DelegateRecord,
  type DiscourseUserRecord,
  type VoterRecord,
} from './deterministic';

function makeDelegate(
  overrides: Partial<DelegateRecord> & Pick<DelegateRecord, 'id'>
): DelegateRecord {
  return {
    id: overrides.id,
    daoId: overrides.daoId ?? 'dao-1',
    discourseUserIds: overrides.discourseUserIds ?? [],
    voterIds: overrides.voterIds ?? [],
  };
}

function makeDiscourseUser(
  overrides: Partial<DiscourseUserRecord> & Pick<DiscourseUserRecord, 'id'>
): DiscourseUserRecord {
  return {
    id: overrides.id,
    daoId: overrides.daoId ?? 'dao-1',
    username: overrides.username ?? 'delegate',
    name: overrides.name ?? null,
  };
}

function makeVoter(
  overrides: Partial<VoterRecord> & Pick<VoterRecord, 'id'>
): VoterRecord {
  return {
    id: overrides.id,
    daoId: overrides.daoId ?? 'dao-1',
    address: overrides.address ?? '0x0000000000000000000000000000000000000000',
    ens: overrides.ens ?? null,
  };
}

describe('buildDelegateCases', () => {
  it('only produces cases for delegates with exactly one mapped identity side', () => {
    const delegates = [
      makeDelegate({
        id: 'delegate-1',
        discourseUserIds: ['discourse-1'],
      }),
      makeDelegate({
        id: 'delegate-2',
        voterIds: ['voter-1'],
      }),
      makeDelegate({
        id: 'delegate-3',
        discourseUserIds: ['discourse-2'],
        voterIds: ['voter-2'],
      }),
      makeDelegate({
        id: 'delegate-4',
      }),
    ];

    const cases = buildDelegateCases(delegates);

    expect(cases).toEqual([
      {
        delegateId: 'delegate-1',
        missingSide: 'voter',
        sourceDiscourseUserId: 'discourse-1',
      },
      {
        delegateId: 'delegate-2',
        missingSide: 'discourse_user',
        sourceVoterId: 'voter-1',
      },
    ]);
  });
});

describe('buildDiscourseSeedCandidates', () => {
  it('selects users with more than ten proposal-category posts and no active delegate link', () => {
    const candidates = buildDiscourseSeedCandidates({
      discourseUsers: [
        makeDiscourseUser({
          id: 'discourse-1',
          username: 'alice',
          name: 'Alice',
        }),
        makeDiscourseUser({
          id: 'discourse-2',
          username: 'bob',
          name: 'Bob',
        }),
      ],
      proposalCategoryPostCounts: new Map([
        ['discourse-1', 11],
        ['discourse-2', 10],
      ]),
      delegates: [
        makeDelegate({
          id: 'delegate-1',
          discourseUserIds: ['discourse-2'],
        }),
      ],
    });

    expect(candidates).toEqual([
      {
        discourseUserId: 'discourse-1',
        username: 'alice',
        proposalCategoryPostCount: 11,
        historicalDelegateIds: [],
      },
    ]);
  });

  it('marks one historical delegate as repairable and multiple historical delegates as ambiguous', () => {
    const candidates = buildDiscourseSeedCandidates({
      discourseUsers: [
        makeDiscourseUser({
          id: 'discourse-1',
          username: 'alice',
          name: 'Alice',
        }),
        makeDiscourseUser({
          id: 'discourse-2',
          username: 'bob',
          name: 'Bob',
        }),
      ],
      proposalCategoryPostCounts: new Map([
        ['discourse-1', 12],
        ['discourse-2', 15],
      ]),
      delegates: [],
      historicalDelegateIdsByDiscourseUserId: new Map([
        ['discourse-1', ['delegate-1']],
        ['discourse-2', ['delegate-2', 'delegate-3']],
      ]),
    });

    expect(candidates[0]).toMatchObject({
      discourseUserId: 'discourse-1',
      repairDelegateId: 'delegate-1',
    });
    expect(candidates[1]).toMatchObject({
      discourseUserId: 'discourse-2',
      ambiguousHistoricalDelegateIds: ['delegate-2', 'delegate-3'],
    });
  });
});

describe('delegate candidate ranking', () => {
  it('prefers voters whose ENS matches the mapped discourse username', () => {
    const currentCase: DelegateCase = {
      delegateId: 'delegate-1',
      missingSide: 'voter',
      sourceDiscourseUserId: 'discourse-1',
    };
    const sourceUser = makeDiscourseUser({
      id: 'discourse-1',
      username: 'delegate',
      name: 'Delegate',
    });
    const voters = [
      makeVoter({
        id: 'voter-1',
        ens: 'delegate.eth',
      }),
      makeVoter({
        id: 'voter-2',
        ens: 'someone-else.eth',
      }),
    ];

    const ranked = rankVoterCandidates(currentCase, sourceUser, voters);

    expect(ranked[0]?.id).toBe('voter-1');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? -1);
  });

  it('prefers discourse users whose username matches the mapped voter ENS stem', () => {
    const currentCase: DelegateCase = {
      delegateId: 'delegate-1',
      missingSide: 'discourse_user',
      sourceVoterId: 'voter-1',
    };
    const sourceVoter = makeVoter({
      id: 'voter-1',
      ens: 'alice.eth',
    });
    const discourseUsers = [
      makeDiscourseUser({
        id: 'discourse-1',
        username: 'alice',
      }),
      makeDiscourseUser({
        id: 'discourse-2',
        username: 'bob',
      }),
    ];

    const ranked = rankDiscourseUserCandidates(
      currentCase,
      sourceVoter,
      discourseUsers
    );

    expect(ranked[0]?.id).toBe('discourse-1');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? -1);
  });
});
