import { describe, expect, it } from 'vitest';
import type { ProcessedVote } from '@/lib/results_processing';
import type { VotesWithVoters } from '../actions';
import {
  buildResultsTableRows,
  defaultVoterAvatar,
} from './results-table-rows';

const createdAt = new Date('2026-01-02T03:04:05.000Z');

function processedVote(voterAddress: string, votingPower: number) {
  return {
    id: `vote-${voterAddress}`,
    choice: [{ choiceIndex: 0, weight: 100, text: 'For', color: '#00ff00' }],
    createdAt,
    proposalId: 'proposal-1',
    reason: '',
    voterAddress,
    votingPower,
    relativeVotingPower: 0.5,
  } satisfies ProcessedVote;
}

function voteWithVoter(voterAddress: string): VotesWithVoters[number] {
  return {
    id: `vote-${voterAddress}`,
    choice: 0,
    createdAt,
    proposalId: 'proposal-1',
    reason: '',
    voterAddress,
    votingPower: 10,
    ens: 'alice.eth',
    avatar: 'https://example.com/alice.png',
    latestVotingPower: 12,
    discourseUsername: 'alice',
    discourseAvatarUrl: null,
  };
}

describe('buildResultsTableRows', () => {
  it('joins voter details onto each processed vote', () => {
    const rows = buildResultsTableRows(
      [processedVote('0xa', 10), processedVote('0xb', 20)],
      [voteWithVoter('0xa')]
    );

    expect(rows).toEqual([
      {
        id: 'vote-0xa',
        choice: [
          { choiceIndex: 0, weight: 100, text: 'For', color: '#00ff00' },
        ],
        createdAt: createdAt.getTime(),
        reason: null,
        voterAddress: '0xa',
        votingPower: 10,
        relativeVotingPower: 0.5,
        voter: {
          ens: 'alice.eth',
          avatar: 'https://example.com/alice.png',
          discourseUsername: 'alice',
          latestVotingPower: 12,
        },
      },
      expect.objectContaining({ voterAddress: '0xb', voter: null }),
    ]);
  });

  it('omits the generated default avatar so the client can rebuild it', () => {
    const voter = {
      ...voteWithVoter('0xa'),
      avatar: defaultVoterAvatar('0xa'),
    };

    const [row] = buildResultsTableRows([processedVote('0xa', 10)], [voter]);

    expect(row.voter?.avatar).toBeNull();
  });

  it('builds rows for proposals with 150k votes', () => {
    const count = 150_000;
    const addresses = Array.from({ length: count }, (_, i) => `0x${i}`);
    const rows = buildResultsTableRows(
      addresses.map((address) => processedVote(address, 1)),
      addresses.map(voteWithVoter)
    );

    expect(rows).toHaveLength(count);
    expect(rows.every((row) => row.voter?.ens === 'alice.eth')).toBe(true);
  });
});
