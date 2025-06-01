import { formatNumberWithSuffix } from '@/lib/utils';
import { ProcessedResults } from '@/lib/results_processing';
import React from 'react';
import { HiddenVote } from './hidden-vote';
import { VoteSegmentData } from '@/lib/types';

interface ApprovalVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export const ApprovalVote = ({ result }: ApprovalVoteProps) => {
  let winningChoice = 'Hidden';
  let maxVotingPower = 0;
  let winningPercentage = 0;

  if (!(result.hiddenVote && result.scoresState !== 'final')) {
    const { choices, finalResults } = result;
    let currentWinningChoice = 'Unknown';
    let currentMaxVotingPower = 0;

    for (const [choiceIndex, votingPower] of Object.entries(finalResults)) {
      if (votingPower > currentMaxVotingPower) {
        currentMaxVotingPower = votingPower;
        currentWinningChoice = choices[Number(choiceIndex)] || 'Unknown';
      }
    }

    const totalVotingPower = Object.values(finalResults).reduce(
      (sum, power) => sum + power,
      0
    );

    winningChoice = currentWinningChoice;
    maxVotingPower = currentMaxVotingPower;
    winningPercentage =
      totalVotingPower > 0 ? (maxVotingPower / totalVotingPower) * 100 : 0;
  }

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  return (
    <div className='flex-col items-center justify-between space-y-1'>
      <div className='border-neutral-350 flex h-4 w-full overflow-hidden border'>
        <div
          className='bg-for-600 h-full'
          style={{ width: `${winningPercentage}%` }}
        />
      </div>
      <div className='flex w-full justify-between'>
        <div className='truncate text-sm font-bold'>{winningChoice}</div>
        <div className='text-sm'>{formatNumberWithSuffix(maxVotingPower)}</div>
      </div>
    </div>
  );
};
