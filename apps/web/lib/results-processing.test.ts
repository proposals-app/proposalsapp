import type { Proposal, Selectable, Vote } from '@proposalsapp/db';
import { describe, expect, it } from 'vitest';
import { processResultsAction, type VoteType } from './results_processing';

type VoteInput = Pick<
  Selectable<Vote>,
  | 'choice'
  | 'createdAt'
  | 'proposalId'
  | 'reason'
  | 'voterAddress'
  | 'votingPower'
  | 'id'
>;

function proposal(voteType: VoteType, choices: string[]): Selectable<Proposal> {
  return {
    author: '0xauthor',
    blockCreatedAt: null,
    blockEndAt: null,
    blockStartAt: null,
    body: 'Proposal body',
    choices,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    daoId: 'dao-1',
    discussionUrl: null,
    endAt: new Date('2026-01-03T00:00:00.000Z'),
    externalId: 'external-1',
    governorId: 'governor-1',
    id: 'proposal-1',
    markedSpam: false,
    metadata: { voteType, scoresState: 'final' },
    name: 'Test proposal',
    proposalState: 'EXECUTED',
    quorum: 0,
    startAt: new Date('2026-01-02T00:00:00.000Z'),
    txid: null,
    url: 'https://example.com/proposal',
  } as Selectable<Proposal>;
}

function vote(
  id: string,
  choice: VoteInput['choice'],
  votingPower: number,
  seconds = 0
): VoteInput {
  return {
    choice,
    createdAt: new Date(Date.UTC(2026, 0, 2, 0, 0, seconds)),
    id,
    proposalId: 'proposal-1',
    reason: null,
    voterAddress: `0x${id}`,
    votingPower,
  };
}

function process(voteType: VoteType, choices: string[], votes: VoteInput[]) {
  return processResultsAction(proposal(voteType, choices), votes, {
    withVotes: true,
    withTimeseries: true,
    aggregatedVotes: false,
  });
}

describe('processResultsAction', () => {
  it('uses zero-based numeric choices normalized by Snapshot ingestion', () => {
    const result = process(
      'single-choice',
      ['First', 'Second'],
      [vote('1', 1, 42)]
    );

    expect(result.finalResults).toEqual({ 0: 0, 1: 42 });
    expect(result.votes?.[0].choice[0]).toMatchObject({
      choiceIndex: 1,
      text: 'Second',
    });
  });

  it('normalizes weighted allocations from the provider object shape', () => {
    const result = process(
      'weighted',
      ['A', 'B'],
      [vote('1', { 1: 25, 2: 75 }, 100)]
    );

    expect(result.finalResults).toEqual({ 0: 25, 1: 75 });
    expect(result.totalVotingPower).toBe(100);
  });

  it('gives full voting power to every approved choice', () => {
    const result = process(
      'approval',
      ['A', 'B', 'C'],
      [vote('1', [1, 3], 10)]
    );

    expect(result.finalResults).toEqual({ 0: 10, 1: 0, 2: 10 });
    expect(result.totalVotingPower).toBe(10);
  });

  it('runs instant runoff voting on complete provider rankings', () => {
    const result = process(
      'ranked-choice',
      ['A', 'B', 'C'],
      [vote('1', [1, 2, 3], 60), vote('2', [2, 1, 3], 40, 1)]
    );

    expect(result.finalResults).toMatchObject({ 0: 60, 1: 40, 2: 0 });
    expect(
      (result.finalResults as Record<string, number>)['Winning threshold']
    ).toBe(50);
  });

  it('implements Snapshot quadratic scoring and preserves total power', () => {
    const result = process(
      'quadratic',
      ['A', 'B'],
      [
        vote('alice', { 1: 9 }, 9),
        vote('bob', { 2: 4 }, 4, 1),
        vote('maria', { 2: 1 }, 1, 2),
        vote('john', { 2: 1 }, 1, 3),
      ]
    );

    expect(result.finalResults[0]).toBeCloseTo(5.4, 10);
    expect(result.finalResults[1]).toBeCloseTo(9.6, 10);
    expect(result.totalVotingPower).toBe(15);

    const cumulativeSeries = result.timeSeriesData?.reduce(
      (totals, point) => {
        for (const [choiceIndex, value] of Object.entries(point.values)) {
          totals[Number(choiceIndex)] += value;
        }
        return totals;
      },
      { 0: 0, 1: 0 } as Record<number, number>
    );
    expect(cumulativeSeries?.[0]).toBeCloseTo(result.finalResults[0], 10);
    expect(cumulativeSeries?.[1]).toBeCloseTo(result.finalResults[1], 10);
  });

  it('computes relative voting power for proposals with 200k votes', () => {
    const votes = Array.from({ length: 200_000 }, (_, index) =>
      vote(`v${index}`, 0, index === 1234 ? 500 : 1)
    );

    const result = process('single-choice', ['For', 'Against'], votes);

    expect(result.votes).toHaveLength(200_000);
    const top = result.votes?.find((v) => v.id === 'v1234');
    expect(top?.relativeVotingPower).toBe(1);
    expect(result.votes?.[0].relativeVotingPower).toBe(1 / 500);
  });

  it('rejects provider-invalid choice shapes instead of misattributing them', () => {
    const result = process(
      'weighted',
      ['A', 'B'],
      [
        vote('scalar', 0, 100),
        vote('bad-key', { 3: 100 }, 100),
        vote('negative', { 1: -1 }, 100),
      ]
    );

    expect(result.votes).toEqual([]);
    expect(result.finalResults).toEqual({ 0: 0, 1: 0 });
    expect(result.totalVotingPower).toBe(0);
  });
});
