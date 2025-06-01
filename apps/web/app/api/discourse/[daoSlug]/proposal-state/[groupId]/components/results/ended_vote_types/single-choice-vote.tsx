import { formatNumberWithSuffix } from '@/lib/utils';
import React from 'react';
import { HiddenVote } from './hidden-vote';
import {
  DEFAULT_CHOICE_COLOR,
  ProcessedResults,
} from '@/lib/results_processing';
import { VoteSegmentData } from '@/lib/types';

interface SingleChoiceVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export const SingleChoiceVote = ({ result }: SingleChoiceVoteProps) => {
  let winningChoice = 'Hidden';
  let winningChoiceColor = DEFAULT_CHOICE_COLOR;
  let maxVotingPower = 0;
  let winningPercentage = 0;

  if (!(result.hiddenVote && result.scoresState !== 'final')) {
    const { choices, choiceColors, finalResults } = result;
    let currentWinningChoice = 'Unknown';
    let currentWinningColor = DEFAULT_CHOICE_COLOR;
    let currentMaxVotingPower = 0;

    for (const [choiceIndex, votingPower] of Object.entries(finalResults)) {
      if (votingPower > currentMaxVotingPower) {
        currentMaxVotingPower = votingPower;
        currentWinningChoice = choices[Number(choiceIndex)] || 'Unknown';
        currentWinningColor =
          choiceColors[Number(choiceIndex)] || DEFAULT_CHOICE_COLOR;
      }
    }

    const totalVotingPower = Object.values(finalResults).reduce(
      (sum, power) => sum + power,
      0
    );

    winningChoice = currentWinningChoice;
    winningChoiceColor = currentWinningColor;
    maxVotingPower = currentMaxVotingPower;
    winningPercentage =
      totalVotingPower > 0 ? (maxVotingPower / totalVotingPower) * 100 : 0;
  }

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  return (
    <div tw='flex flex-col items-center justify-between space-y-1'>
      <div tw='border-neutral-350 flex h-4 w-full overflow-hidden border'>
        <div
          tw='h-full'
          style={{
            width: `${winningPercentage}%`,
            backgroundColor: winningChoiceColor,
          }}
        />
      </div>
      <div tw='flex w-full justify-between'>
        <div tw='truncate text-sm font-bold'>{winningChoice}</div>
        <div tw='text-sm'>{formatNumberWithSuffix(maxVotingPower)}</div>
      </div>
    </div>
  );
};
