import { formatNumberWithSuffix } from '@/lib/utils';
import React from 'react';
import { HiddenVote } from './hidden-vote';
import { ProcessedResults } from '@/lib/results_processing';
import PassedSmallIcon from '@/public/assets/web/icons/check-small.svg';
import FailedSmallIcon from '@/public/assets/web/icons/cross-small.svg';
import { VoteSegmentData } from '@/lib/types';

interface BasicVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
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
    tw={'h-full'}
    style={{
      width: `${width}%`,
      marginRight: 1,
      background: isAggregated
        ? `repeating-linear-gradient(90deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 2px)`
        : color,
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
    <div tw='relative flex h-2 w-full'>
      {/* Quorum Line */}
      {quorumPercentage > 0 && quorumPercentage <= 100 && (
        <div
          tw='absolute -top-1 z-10 h-4 w-0.5 bg-neutral-900 dark:bg-neutral-50'
          style={{
            left: `${quorumPercentage}%`,
            transform:
              quorumPercentage === 100 ? 'translateX(-100%)' : 'translateX(0%)',
          }}
        />
      )}
      {/* Choices that count towards quorum */}
      <div tw='absolute inset-0 flex overflow-hidden border border-neutral-800 dark:border-neutral-200'>
        {quorumContributingChoices.map((choice, index) => {
          const choiceWidthPercentage =
            totalDelegatedVp > 0
              ? (choice.votingPower / totalDelegatedVp) * 100
              : 0;
          if (choiceWidthPercentage <= 0) return null;

          return (
            <div
              key={`quorum-segment-${choice.choiceIndex}-${index}`}
              tw='h-full'
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

export const BasicVote = ({ result }: BasicVoteProps) => {
  const finalResults =
    result.hiddenVote && result.scoresState !== 'final'
      ? {}
      : result.finalResults || {};
  const totalVotingPower =
    result.hiddenVote && result.scoresState !== 'final'
      ? 0
      : result.totalVotingPower || 0;
  const choiceColors = result.choiceColors || [];
  const choices = result.choices || [];
  const quorum = result.quorum || 0;
  const voteSegments = result.voteSegments || {};
  const totalDelegatedVp = result.totalDelegatedVp || 0;
  const quorumChoices = result.quorumChoices || [];

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
  const quorumVotingPower = Object.entries(finalResults)
    .filter(([choiceIndex]) => quorumChoices.includes(parseInt(choiceIndex)))
    .reduce((sum, [, votingPower]) => sum + votingPower, 0);

  const hasQuorum = quorumVotingPower > quorum;

  // Prepare data for the segmented quorum bar
  const quorumContributingChoices = !totalDelegatedVp
    ? []
    : quorumChoices
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

  // Find indices for For/Against/Abstain safely
  const forIndex = choices.indexOf('For');
  const againstIndex = choices.indexOf('Against');
  const abstainIndex = choices.indexOf('Abstain');

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  if (!totalVotingPower && !result.hiddenVote) {
    return <div tw='text-sm text-neutral-500'>No votes recorded</div>;
  }

  return (
    <div tw='flex flex-col'>
      <div tw='flex h-4 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-700'>
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

      <div tw='mt-1 flex justify-between text-sm'>
        {isBasicVote ? (
          <>
            <div tw='flex items-center gap-1'>
              {winningChoice.choiceIndex === forIndex && forIndex !== -1 && (
                <PassedSmallIcon tw='fill-for-600 dark:fill-for-400' />
              )}
              <span tw='font-bold'>For </span>
              <span>
                {formatNumberWithSuffix(
                  forIndex !== -1 ? finalResults[forIndex] || 0 : 0
                )}
              </span>
            </div>
            <div tw='flex items-center gap-1'>
              <span>
                {formatNumberWithSuffix(
                  againstIndex !== -1 ? finalResults[againstIndex] || 0 : 0
                )}{' '}
              </span>
              <span tw='font-bold'>Against</span>
              {winningChoice.choiceIndex === againstIndex &&
                againstIndex !== -1 && (
                  <FailedSmallIcon tw='fill-against-600 dark:fill-against-400' />
                )}
            </div>
          </>
        ) : (
          winningChoice.choiceIndex !== -1 && (
            <div tw='flex items-center gap-1'>
              <PassedSmallIcon tw='fill-for-600 dark:fill-for-400' />
              <span tw='font-bold'>{choices[winningChoice.choiceIndex]} </span>
              <span>{formatNumberWithSuffix(winningChoice.votingPower)}</span>
            </div>
          )
        )}
      </div>

      {quorum > 0 && totalDelegatedVp > 0 && (
        <div tw='mt-4 flex flex-col'>
          <SegmentedQuorumBar
            quorumContributingChoices={quorumContributingChoices}
            quorum={quorum}
            totalDelegatedVp={totalDelegatedVp}
          />

          <div tw='flex items-start justify-between py-1 text-xs'>
            <div tw='flex items-center gap-1'>
              {hasQuorum ? (
                <PassedSmallIcon tw='fill-for-600 dark:fill-for-400' />
              ) : (
                <FailedSmallIcon tw='fill-against-600 dark:fill-against-400' />
              )}
              <span tw='font-bold'>
                {formatNumberWithSuffix(quorumVotingPower)}
              </span>
              <span>of</span>
              <span>{formatNumberWithSuffix(quorum)} for Quorum</span>
            </div>
            <div tw='flex'>
              <span tw='font-semibold'>
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
