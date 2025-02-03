import { formatNumberWithSuffix } from '@/lib/utils';
import React, { useMemo } from 'react';
import { HiddenVote } from './HiddenVote';
import { ProcessedResults } from '@/lib/results_processing';
import { Check } from 'lucide-react';

interface BasicVoteProps {
  result: ProcessedResults;
}

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

    const totalVotingPower = result.totalVotingPower;
    const choiceColors = result.choiceColors || [];
    const choices = result.choices || [];
    const quorum = result.quorum || 0;
    const scoresQuorum = result.proposal.scoresQuorum || 0;

    return {
      finalResults: result.finalResults || {},
      totalVotingPower,
      choiceColors,
      choices,
      quorum,
      scoresQuorum,
    };
  }, [result]);

  if (result.hiddenVote && result.scoresState !== 'final') {
    return <HiddenVote result={result} />;
  }

  if (!totalVotingPower) {
    return <div>No votes recorded</div>;
  }

  const VoteSegment = ({
    color,
    width,
    tooltip,
  }: {
    color: string;
    width: number;
    tooltip: string;
  }) => (
    <div
      className={'h-full border-white hover:opacity-90'}
      style={{ width: `${width}%`, backgroundColor: color }}
      title={tooltip}
    />
  );

  // Calculate total voting power for each choice
  const votingPowerByChoice = Object.entries(finalResults).map(
    ([choiceIndex, votingPower]) => ({
      choiceIndex: parseInt(choiceIndex),
      votingPower,
      formattedVotes: formatNumberWithSuffix(votingPower),
      color: choiceColors[parseInt(choiceIndex)] || '#CBD5E1', // Default grey color if no color provided
    })
  );

  // Determine the winning option based on voting power
  const winningChoice = votingPowerByChoice.reduce(
    (a, b) => (a.votingPower > b.votingPower ? a : b),
    { choiceIndex: -1, votingPower: 0 }
  );

  // Calculate participation percentage
  const totalDelegatedVp = result.totalDelegatedVp || 0;
  const participationPercentage = (totalVotingPower / totalDelegatedVp) * 100;

  // Check if quorum is reached
  const quorumReached = scoresQuorum >= quorum;

  return (
    <div className='space-y-1'>
      <div className='flex h-4 w-full overflow-hidden border'>
        {votingPowerByChoice.map(({ choiceIndex, votingPower, color }) => (
          <VoteSegment
            key={choiceIndex}
            color={color}
            width={(votingPower / totalVotingPower) * 100}
            tooltip={`${formatNumberWithSuffix(votingPower)} voting power for ${choices[choiceIndex]}`}
          />
        ))}
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
              className='absolute top-0 left-0 h-full bg-neutral-800'
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
              of tokens have voted
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
