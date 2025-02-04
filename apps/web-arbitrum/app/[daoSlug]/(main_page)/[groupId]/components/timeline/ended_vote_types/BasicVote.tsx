import { formatNumberWithSuffix } from '@/lib/utils';
import React, { useMemo } from 'react';
import { HiddenVote } from './HiddenVote';
import { ProcessedResults } from '@/lib/results_processing';
import { Check } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface BasicVoteProps {
  result: ProcessedResults;
}

interface VoteSegmentData {
  votingPower: number;
  tooltip: string;
  isAggregated?: boolean;
}

const MIN_VISIBLE_WIDTH_PERCENT = 1;

const VoteSegment = ({
  color,
  width,
  tooltip,
  isAggregated = false,
}: {
  color: string;
  width: number;
  tooltip: string;
  isAggregated?: boolean;
}) => (
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div
          className={'h-full opacity-75'}
          style={{
            width: `${width}%`,
            ...(isAggregated
              ? {
                  background: `repeating-linear-gradient(
                    90deg,
                    ${color} 0px,
                    ${color} 1px,
                    transparent 1px,
                    transparent 2px
                  )`,
                }
              : { backgroundColor: color, marginRight: 1 }),
          }}
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className='rounded border bg-white p-2 text-sm shadow-md dark:bg-neutral-800 dark:text-neutral-100'
          sideOffset={5}
        >
          {tooltip}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);

export const BasicVote = ({ result }: BasicVoteProps) => {
  const {
    finalResults,
    totalVotingPower,
    choiceColors,
    choices,
    quorum,
    scoresQuorum,
  } = useMemo(() => {
    if (result.hiddenVote && result.scoresState !== 'final') {
      return {
        finalResults: {},
        totalVotingPower: 0,
        choiceColors: result.choiceColors || [],
        choices: result.choices || [],
        quorum: result.quorum || 0,
        scoresQuorum: result.proposal.scoresQuorum || 0,
      };
    }

    return {
      finalResults: result.finalResults || {},
      totalVotingPower: result.totalVotingPower,
      choiceColors: result.choiceColors || [],
      choices: result.choices || [],
      quorum: result.quorum || 0,
      scoresQuorum: result.proposal.scoresQuorum || 0,
    };
  }, [result]);

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  if (!totalVotingPower) {
    return <div>No votes recorded</div>;
  }

  // Get all votes sorted by voting power in descending order
  const sortedVotes =
    result.votes
      ?.filter((vote) => !vote.aggregate) // Exclude aggregated votes
      .sort((a, b) => b.votingPower - a.votingPower) || [];

  // Process votes into segments for each choice
  const voteSegments: { [key: number]: VoteSegmentData[] } = {};
  const aggregatedVotes: { [key: number]: { count: number; power: number } } =
    {};

  // Initialize segments for each choice
  choices.forEach((_, index) => {
    voteSegments[index] = [];
    aggregatedVotes[index] = { count: 0, power: 0 };
  });

  // Process each vote
  sortedVotes.forEach((vote) => {
    const choice = vote.choice as number;
    const percentage = (vote.votingPower / totalVotingPower) * 100;

    if (percentage >= MIN_VISIBLE_WIDTH_PERCENT) {
      // Add as individual segment
      voteSegments[choice].push({
        votingPower: vote.votingPower,
        tooltip: `${formatNumberWithSuffix(vote.votingPower)} vote "${
          choices[choice]
        }"`,
      });
    } else {
      // Add to aggregated votes
      aggregatedVotes[choice].count += 1;
      aggregatedVotes[choice].power += vote.votingPower;
    }
  });

  // Add aggregated segments
  Object.entries(aggregatedVotes).forEach(([choice, data]) => {
    if (data.power > 0) {
      voteSegments[Number(choice)].push({
        votingPower: data.power,
        tooltip: `${data.count} votes with ${formatNumberWithSuffix(
          data.power
        )} total voting power for "${choices[Number(choice)]}"`,
        isAggregated: true,
      });
    }
  });

  // Calculate total voting power for each choice
  const votingPowerByChoice = Object.entries(finalResults).map(
    ([choiceIndex, votingPower]) => ({
      choiceIndex: parseInt(choiceIndex),
      votingPower,
      formattedVotes: formatNumberWithSuffix(votingPower),
    })
  );

  // Determine the winning option based on voting power
  const winningChoice = votingPowerByChoice.reduce(
    (a, b) => (a.votingPower > b.votingPower ? a : b),
    { choiceIndex: -1, votingPower: 0, formattedVotes: '' }
  );

  // Calculate participation percentage
  const totalDelegatedVp = result.totalDelegatedVp || 0;
  const participationPercentage = (totalVotingPower / totalDelegatedVp) * 100;

  // Check if quorum is reached
  const quorumReached = scoresQuorum >= quorum;

  return (
    <div className='space-y-1'>
      <div className='flex h-4 w-full overflow-hidden'>
        {Object.entries(voteSegments).map(([choice, segments]) =>
          segments.map((segment, index) => (
            <VoteSegment
              key={`${choice}-${index}`}
              color={choiceColors[Number(choice)]}
              width={(segment.votingPower / totalVotingPower) * 100}
              tooltip={segment.tooltip}
              isAggregated={segment.isAggregated}
            />
          ))
        )}
      </div>

      <div className='flex justify-between text-sm'>
        {votingPowerByChoice.map(({ choiceIndex, formattedVotes }) => (
          <div key={choiceIndex} className='flex items-center gap-1'>
            {choiceIndex === winningChoice.choiceIndex && <Check size={14} />}
            <span
              className={
                choiceIndex === winningChoice.choiceIndex ? 'font-bold' : ''
              }
            >
              {choices[choiceIndex]}
            </span>
            <span>{formattedVotes}</span>
          </div>
        ))}
      </div>

      {/* Quorum and Participation Segments */}
      {totalDelegatedVp > 0 && (
        <div className='mt-4'>
          <div className='border-neutral-80 relative h-2 w-full border'>
            <div
              className='absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-300'
              style={{
                width: `${participationPercentage}%`,
              }}
            />
          </div>

          <div className='flex items-start justify-between text-[11px]'>
            <div className='flex items-center gap-1'>
              {quorumReached && <Check size={12} />}
              <span className='font-bold'>
                {formatNumberWithSuffix(scoresQuorum)}
              </span>
              <span>of </span>
              <span>{formatNumberWithSuffix(quorum)} needed</span>
            </div>

            <div>
              <span className='font-semibold'>
                {participationPercentage.toFixed(0)}%
              </span>{' '}
              have voted
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
