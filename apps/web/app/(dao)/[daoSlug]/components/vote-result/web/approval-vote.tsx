import { formatNumberWithSuffix } from '@/lib/utils';
import type { ProcessedResults } from '@/lib/results_processing';
import React, { useMemo } from 'react';
import { HiddenVote } from './hidden-vote';
import type { VoteSegmentData } from '@/lib/types';

interface ApprovalVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  expanded?: boolean;
}

export const ApprovalVote = ({
  result,
  expanded = true,
}: ApprovalVoteProps) => {
  const { winningChoice, winningPercentage, maxVotingPower } = useMemo(() => {
    if (result.hiddenVote && result.scoresState !== 'final') {
      return {
        winningChoice: 'Hidden',
        totalVotingPower: 0,
        winningPercentage: 0,
        maxVotingPower: 0,
      };
    }

    const { choices, finalResults } = result;

    let winningChoice = 'Unknown';
    let maxVotingPower = 0;

    for (const [choiceIndex, votingPower] of Object.entries(finalResults)) {
      if (votingPower > maxVotingPower) {
        maxVotingPower = votingPower;
        winningChoice = choices[Number(choiceIndex)] || 'Unknown';
      }
    }

    const totalVotingPower = Object.values(finalResults).reduce(
      (sum, power) => sum + power,
      0
    );

    const winningPercentage = (maxVotingPower / totalVotingPower) * 100;

    return {
      winningChoice,
      winningPercentage,
      maxVotingPower,
    };
  }, [result]);

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} expanded={expanded} />;
  }

  return (
    <div className='flex-col items-center justify-between'>
      <div className='flex h-4 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-700'>
        <div
          className='h-full bg-for-600'
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
