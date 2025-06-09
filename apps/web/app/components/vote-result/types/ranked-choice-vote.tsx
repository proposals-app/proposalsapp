import { formatNumberWithSuffix } from '@/lib/utils';
import React, { useMemo } from 'react';
import { HiddenVote } from './hidden-vote';
import {
  DEFAULT_CHOICE_COLOR,
  type ProcessedResults,
} from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';

interface RankedChoiceVoteProps {
  expanded?: boolean;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export const RankedChoiceVote = ({
  result,
  expanded: _expanded = true,
}: RankedChoiceVoteProps) => {
  const {
    winningChoice,
    winningChoiceColor,
    winningPercentage,
    maxVotingPower,
  } = useMemo(() => {
    if (result.hiddenVote && result.scoresState !== 'final') {
      return {
        winningChoice: 'Hidden',
        winningChoiceColor: DEFAULT_CHOICE_COLOR,
        totalVotingPower: 0,
        winningPercentage: 0,
        maxVotingPower: 0,
      };
    }

    const { choices, choiceColors, finalResults } = result;

    let winningChoice = 'Unknown';
    let winningChoiceColor = DEFAULT_CHOICE_COLOR;
    let maxVotingPower = 0;

    for (const [choiceIndex, votingPower] of Object.entries(finalResults)) {
      if (votingPower > maxVotingPower) {
        maxVotingPower = votingPower;
        winningChoice = choices[Number(choiceIndex)] || 'Unknown';
        winningChoiceColor =
          choiceColors[Number(choiceIndex)] || DEFAULT_CHOICE_COLOR;
      }
    }

    const totalVotingPower = Object.values(finalResults).reduce(
      (sum, power) => sum + power,
      0
    );

    const winningPercentage = (maxVotingPower / totalVotingPower) * 100;

    return {
      winningChoice,
      winningChoiceColor,
      winningPercentage,
      maxVotingPower,
    };
  }, [result]);

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  return (
    <div className='flex-col items-center justify-between'>
      <div className='flex h-4 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-700'>
        <div
          className='h-full'
          style={{
            width: `${winningPercentage}%`,
            backgroundColor: winningChoiceColor,
          }}
        />
      </div>
      <div className='flex w-full justify-between'>
        <div className='truncate text-sm font-bold'>{winningChoice}</div>
        <div className='text-sm'>{formatNumberWithSuffix(maxVotingPower)}</div>
      </div>
    </div>
  );
};
