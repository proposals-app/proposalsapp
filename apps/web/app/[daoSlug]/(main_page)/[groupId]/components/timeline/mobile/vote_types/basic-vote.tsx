import { formatNumberWithSuffix } from '@/lib/utils';
import React, { useMemo } from 'react';
import { HiddenVote } from './hidden-vote';
import { ProcessedResults } from '@/lib/results_processing';
import PassedSmallIcon from '@/public/assets/web/icons/check-small.svg';
import FailedSmallIcon from '@/public/assets/web/icons/cross-small.svg';
import { VoteSegmentData } from '@/lib/types';

interface BasicVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  expanded: boolean;
}

interface VoteSegmentProps {
  color: string;
  width: number;
  isAggregated?: boolean;
}

export const VoteSegment = ({
  color,
  width,
  isAggregated = false,
}: VoteSegmentProps) => (
  <div
    className={'h-full'}
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
);

// New component specifically for the segmented Quorum bar
interface SegmentedQuorumBarProps {
  quorumContributingChoices: {
    choiceIndex: number;
    votingPower: number;
    color: string;
  }[];
  quorum: number;
  totalDelegatedVp: number;
}

const SegmentedQuorumBar = ({
  quorumContributingChoices,
  quorum,
  totalDelegatedVp,
}: SegmentedQuorumBarProps) => {
  const quorumPercentage =
    totalDelegatedVp > 0 ? (quorum / totalDelegatedVp) * 100 : 0;

  return (
    <div className='relative h-2 w-full'>
      {/* Quorum Line */}
      {quorumPercentage > 0 && quorumPercentage <= 100 && (
        <div
          className='absolute -top-1 z-10 h-4 w-0.5 bg-neutral-900 dark:bg-neutral-50'
          style={{
            left: `${quorumPercentage}%`,
            transform: quorumPercentage === 100 ? 'translateX(-100%)' : 'none',
          }}
        />
      )}
      {/* Choices that count towards quorum */}
      <div className='absolute inset-0 flex overflow-hidden border border-neutral-800 dark:border-neutral-200'>
        {quorumContributingChoices.map((choice, index) => {
          const choiceWidthPercentage =
            totalDelegatedVp > 0
              ? (choice.votingPower / totalDelegatedVp) * 100
              : 0;
          if (choiceWidthPercentage <= 0) return null;

          return (
            <div
              key={`quorum-segment-${choice.choiceIndex}-${index}`}
              className='h-full'
              style={{
                width: `${choiceWidthPercentage}%`,
                backgroundColor: choice.color,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export const BasicVote = ({ result, expanded }: BasicVoteProps) => {
  const {
    finalResults,
    totalVotingPower,
    choiceColors,
    choices,
    quorum,
    voteSegments,
    totalDelegatedVp,
    quorumChoices,
  } = useMemo(() => {
    if (result.hiddenVote && result.scoresState !== 'final') {
      return {
        finalResults: {},
        totalVotingPower: 0,
        choiceColors: result.choiceColors || [],
        choices: result.choices || [],
        quorum: result.quorum || 0,
        voteSegments: result.voteSegments || {},
        totalDelegatedVp: result.totalDelegatedVp || 0,
        quorumChoices: result.quorumChoices || [],
      };
    }

    return {
      finalResults: result.finalResults || {},
      totalVotingPower: result.totalVotingPower || 0,
      choiceColors: result.choiceColors || [],
      choices: result.choices || [],
      quorum: result.quorum || 0,
      voteSegments: result.voteSegments || {},
      totalDelegatedVp: result.totalDelegatedVp || 0,
      quorumChoices: result.quorumChoices || [],
    };
  }, [result]);

  const isBasicVote =
    choices.length > 0 && ['For', 'Against', 'Abstain'].includes(choices[0]); // Safer check

  const votingPowerByChoice = Object.entries(finalResults).map(
    ([choiceIndex, votingPower]) => ({
      choiceIndex: parseInt(choiceIndex),
      votingPower,
      formattedVotes: formatNumberWithSuffix(votingPower),
    })
  );

  const winningChoice = votingPowerByChoice.reduce(
    (a, b) => (a.votingPower > b.votingPower ? a : b),
    { choiceIndex: -1, votingPower: 0, formattedVotes: '' }
  );

  // Calculate quorum-related values
  const quorumVotingPower = useMemo(() => {
    return Object.entries(finalResults)
      .filter(([choiceIndex]) => quorumChoices.includes(parseInt(choiceIndex)))
      .reduce((sum, [, votingPower]) => sum + votingPower, 0);
  }, [finalResults, quorumChoices]);

  const hasQuorum = quorumVotingPower > quorum;

  // Prepare data for the segmented quorum bar
  const quorumContributingChoices = useMemo(() => {
    if (!totalDelegatedVp) return [];

    return quorumChoices
      .map((choiceIndex) => {
        const votingPower = finalResults[choiceIndex] || 0;
        const color = choiceColors[choiceIndex];
        return {
          choiceIndex,
          votingPower,
          color,
        };
      })
      .filter((choice) => choice.votingPower > 0);
  }, [quorumChoices, finalResults, choiceColors, totalDelegatedVp]);

  // Find indices for For/Against/Abstain safely
  const forIndex = choices.indexOf('For');
  const againstIndex = choices.indexOf('Against');
  const abstainIndex = choices.indexOf('Abstain');

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} expanded={expanded} />;
  }

  if (!totalVotingPower && !result.hiddenVote) {
    return <div className='text-sm text-neutral-500'>No votes recorded</div>;
  }

  return (
    <div>
      {/* Top Bar (Vote Distribution) */}
      <div className='flex h-4 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-700'>
        {isBasicVote
          ? // Order: For, Abstain, Against
            [forIndex, abstainIndex, againstIndex]
              .filter((index) => index !== -1) // Filter out choices not present
              .map((choiceIndex) => {
                return voteSegments[choiceIndex.toString()]?.map(
                  (segment, index) => (
                    <VoteSegment
                      key={`dist-${choiceIndex}-${index}`}
                      color={choiceColors[choiceIndex]}
                      width={(segment.votingPower / totalVotingPower) * 100}
                      isAggregated={segment.isAggregated}
                    />
                  )
                );
              })
          : // Only show winning choice for non-basic votes (if winning choice exists)
            winningChoice.choiceIndex !== -1 &&
            voteSegments[winningChoice.choiceIndex.toString()]?.map(
              (segment, index) => (
                <VoteSegment
                  key={`dist-winning-${index}`}
                  color={choiceColors[winningChoice.choiceIndex]}
                  width={(segment.votingPower / totalVotingPower) * 100}
                  isAggregated={segment.isAggregated}
                />
              )
            )}
      </div>

      {/* Vote Labels */}
      {expanded && (
        <div className='mt-1 flex justify-between text-sm'>
          {isBasicVote ? (
            // Show For and Against labels for basic votes
            <>
              <div className='flex items-center gap-1'>
                {winningChoice.choiceIndex === forIndex && forIndex !== -1 && (
                  <PassedSmallIcon className='fill-for-600 dark:fill-for-400' />
                )}
                <span className='font-bold'>For </span>
                <span>
                  {formatNumberWithSuffix(
                    forIndex !== -1 ? finalResults[forIndex] || 0 : 0
                  )}
                </span>
              </div>
              <div className='flex items-center gap-1'>
                <span>
                  {formatNumberWithSuffix(
                    againstIndex !== -1 ? finalResults[againstIndex] || 0 : 0
                  )}{' '}
                </span>
                <span className='font-bold'>Against</span>
                {winningChoice.choiceIndex === againstIndex &&
                  againstIndex !== -1 && (
                    <FailedSmallIcon className='fill-against-600 dark:fill-against-400' />
                  )}
              </div>
            </>
          ) : (
            // Show only winning choice for non-basic votes
            winningChoice.choiceIndex !== -1 && ( // Check if winning choice exists
              <div className='flex items-center gap-1'>
                {/* Consider a different icon or logic for non-basic wins? Currently uses Passed */}
                <PassedSmallIcon className='fill-for-600 dark:fill-for-400' />
                <span className='font-bold'>
                  {choices[winningChoice.choiceIndex]}{' '}
                </span>
                <span>{formatNumberWithSuffix(winningChoice.votingPower)}</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Quorum Section (only if quorum and totalDelegatedVp are meaningful) */}
      {expanded && quorum > 0 && totalDelegatedVp > 0 && (
        <div className='mt-4'>
          {/* Segmented Quorum Bar */}
          <SegmentedQuorumBar
            quorumContributingChoices={quorumContributingChoices}
            quorum={quorum}
            totalDelegatedVp={totalDelegatedVp}
          />

          {/* Quorum Text */}
          <div className='flex items-start justify-between py-1 text-xs'>
            {/* Left side: Quorum Status */}
            <div className='flex items-center gap-1'>
              {hasQuorum ? (
                <PassedSmallIcon className='fill-for-600 dark:fill-for-400' />
              ) : (
                <FailedSmallIcon className='fill-against-600 dark:fill-against-400' />
              )}
              <span className='font-bold'>
                {formatNumberWithSuffix(quorumVotingPower)}
              </span>
              <span>of</span>
              <span>{formatNumberWithSuffix(quorum)} for Quorum</span>
            </div>
            <div>
              <span className='font-semibold'>
                {formatNumberWithSuffix(totalVotingPower)}
              </span>{' '}
              ARB voted
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
