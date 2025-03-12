import { formatNumberWithSuffix } from '@/lib/utils';
import React, { useMemo } from 'react';
import { HiddenVote } from './HiddenVote';
import { ProcessedResults } from '@/lib/results_processing';
import PassedSmallIcon from '@/public/assets/web/passed-small.svg';
import FailedSmallIcon from '@/public/assets/web/failed-small.svg';
import { VoteSegmentData } from '../../../actions';

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

export const BasicVote = ({ result }: BasicVoteProps) => {
  const {
    finalResults,
    totalVotingPower,
    choiceColors,
    choices,
    quorum,
    voteSegments,
  } = useMemo(() => {
    if (result.hiddenVote && result.scoresState !== 'final') {
      return {
        finalResults: {},
        totalVotingPower: 0,
        choiceColors: result.choiceColors || [],
        choices: result.choices || [],
        quorum: result.quorum || 0,
        voteSegments: result.voteSegments || {},
      };
    }

    return {
      finalResults: result.finalResults || {},
      totalVotingPower: result.totalVotingPower,
      choiceColors: result.choiceColors || [],
      choices: result.choices || [],
      quorum: result.quorum || 0,
      voteSegments: result.voteSegments || {},
    };
  }, [result]);

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  if (!totalVotingPower) {
    return <div>No votes recorded</div>;
  }

  const isBasicVote = ['For', 'Against', 'Abstain'].includes(choices[0]);

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

  const totalDelegatedVp = result.totalDelegatedVp || 0;
  const participationPercentage = (totalVotingPower / totalDelegatedVp) * 100;

  const quorumChoices = result.quorumChoices || [];

  const quorumVotingPower = Object.entries(finalResults)
    .filter(([choiceIndex]) => quorumChoices.includes(parseInt(choiceIndex)))
    .reduce((sum, [, votingPower]) => sum + votingPower, 0);

  const hasQuorum = quorumVotingPower > (quorum || 0);

  return (
    <div className='space-y-1'>
      <div className='flex h-4 w-full overflow-hidden'>
        {isBasicVote
          ? // Order: For, Abstain, Against
            ['For', 'Abstain', 'Against'].map((choiceLabel) => {
              const choiceIndex = choices.indexOf(choiceLabel);
              if (choiceIndex === -1) return null;

              return voteSegments[choiceIndex.toString()]?.map(
                (segment, index) => (
                  <VoteSegment
                    key={`${choiceLabel}-${index}`}
                    color={choiceColors[choiceIndex]}
                    width={(segment.votingPower / totalVotingPower) * 100}
                    isAggregated={segment.isAggregated}
                  />
                )
              );
            })
          : // Only show winning choice for non-basic votes
            voteSegments[winningChoice.choiceIndex.toString()]?.map(
              (segment, index) => (
                <VoteSegment
                  key={`winning-${index}`}
                  color={choiceColors[winningChoice.choiceIndex]}
                  width={(segment.votingPower / totalVotingPower) * 100}
                  isAggregated={segment.isAggregated}
                />
              )
            )}
      </div>

      <div className='flex justify-between text-sm'>
        {isBasicVote ? (
          // Show For and Against labels for basic votes
          <>
            <div className='flex items-center gap-1'>
              {winningChoice.choiceIndex === choices.indexOf('For') && (
                <PassedSmallIcon />
              )}
              <span className='font-bold'>For </span>
              <span>
                {formatNumberWithSuffix(
                  finalResults[choices.indexOf('For')] || 0
                )}
              </span>
            </div>
            <div className='flex items-center gap-1'>
              {winningChoice.choiceIndex === choices.indexOf('Against') && (
                <PassedSmallIcon />
              )}
              <span>
                {formatNumberWithSuffix(
                  finalResults[choices.indexOf('Against')] || 0
                )}{' '}
              </span>
              <span className='font-bold'>Against</span>
            </div>
          </>
        ) : (
          // Show only winning choice for non-basic votes
          <div className='flex items-center gap-1'>
            <PassedSmallIcon />
            <span className='font-bold'>
              {choices[winningChoice.choiceIndex]}{' '}
            </span>
            <span>{formatNumberWithSuffix(winningChoice.votingPower)}</span>
          </div>
        )}
      </div>

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

          <div className='flex items-start justify-between py-1 text-xs'>
            <div className='flex items-center gap-1'>
              {hasQuorum ? <PassedSmallIcon /> : <FailedSmallIcon />}

              <span className='font-bold'>
                {formatNumberWithSuffix(quorumVotingPower)}
              </span>
              <span>of</span>
              <span>{formatNumberWithSuffix(quorum)} for Quorum</span>
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
