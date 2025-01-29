'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { ProcessedResults } from '@/lib/votes_processing';
import { useState } from 'react';

interface ResultsListProps {
  results: ProcessedResults;
}

export function ResultsList({ results }: ResultsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalVotingPower = results.totalVotingPower;
  const totalDelegatedVp = results.totalDelegatedVp;

  // Calculate voting power for each choice using finalResults
  const choicesWithPower = results.choices.map((choice, index) => ({
    choice,
    votingPower: results.finalResults[index] || 0,
    color: results.choiceColors[index],
    countsTowardsQuorum: results.quorumChoices.includes(index),
  }));

  // Sort by voting power descending
  const sortedChoices = choicesWithPower.sort(
    (a, b) => b.votingPower - a.votingPower
  );

  // Determine which choices to show
  const topChoices = isExpanded ? sortedChoices : sortedChoices.slice(0, 5);
  const otherChoices = isExpanded ? [] : sortedChoices.slice(5);

  // Calculate total voting power for "Other" choices
  const otherVotingPower = otherChoices.reduce(
    (sum, choice) => sum + choice.votingPower,
    0
  );

  const quorumVotingPower = sortedChoices
    .filter((choice) => choice.countsTowardsQuorum)
    .reduce((sum, choice) => sum + choice.votingPower, 0);

  const participationPercentage = totalDelegatedVp
    ? (totalVotingPower / totalDelegatedVp) * 100
    : 0;

  // Find the choice with the highest voting power
  const majorityChoice = sortedChoices[0];

  // Check if the majority choice is "For"
  const hasMajoritySupport =
    majorityChoice &&
    majorityChoice.choice === 'For' &&
    majorityChoice.votingPower > totalVotingPower / 2;

  return (
    <div className='ml-6 w-64'>
      <div className='space-y-4'>
        <div className='space-y-2'>
          {topChoices.map(({ choice, votingPower, color }, index) => {
            const percentage = (votingPower / totalVotingPower) * 100;
            return (
              <ChoiceBar
                key={index}
                choice={choice}
                votingPower={votingPower}
                color={color}
                percentage={isNaN(percentage) ? null : percentage}
              />
            );
          })}

          {otherChoices.length > 0 && (
            <div
              className='cursor-pointer hover:opacity-80'
              onClick={() => setIsExpanded(true)}
            >
              <ChoiceBar
                choice='Other'
                votingPower={otherVotingPower}
                color='#CBD5E1'
                percentage={(otherVotingPower / totalVotingPower) * 100}
              />
            </div>
          )}
        </div>

        {isExpanded && (
          <button className='mt-2 text-sm' onClick={() => setIsExpanded(false)}>
            Show less
          </button>
        )}

        {/* Majority Support Checkmark */}
        <div>
          {hasMajoritySupport && (
            <div>
              {results.quorum !== null && totalDelegatedVp && (
                <div
                  className='w-full text-sm font-semibold'
                  style={{
                    left: `${(results.quorum / totalDelegatedVp) * 100}%`,
                  }}
                >
                  ✓ Majority support
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quorum Bar */}
        <div>
          {results.quorum !== null && totalDelegatedVp && (
            <div className='mb-4'>
              <div className='relative h-4 w-full rounded-lg'>
                {/* Quorum Line */}
                <div
                  className='absolute -top-1 z-10 h-6 w-0.5 bg-neutral-700 dark:bg-neutral-200'
                  style={{
                    left: `${(results.quorum / totalDelegatedVp) * 100}%`,
                  }}
                />

                {/* Choices that count towards quorum */}
                <div
                  className='absolute inset-0 flex overflow-hidden rounded-lg border border-neutral-300
                    bg-white dark:border-neutral-700 dark:bg-neutral-950'
                >
                  {sortedChoices
                    .filter((choice) => choice.countsTowardsQuorum)
                    .map((choice, index) => (
                      <div
                        key={index}
                        className={`h-full ${index === 0 ? 'rounded-l-lg' : ''}`}
                        style={{
                          width: `${(choice.votingPower / totalDelegatedVp) * 100}%`,
                          backgroundColor: choice.color,
                        }}
                      />
                    ))}
                </div>
              </div>
              {/* Quorum Text */}
              <div className='mt-2 text-sm'>
                <span className='font-semibold'>
                  {quorumVotingPower > results.quorum && '✓'}{' '}
                  {formatNumberWithSuffix(quorumVotingPower)}
                </span>{' '}
                of{' '}
                <span className='font-semibold'>
                  {formatNumberWithSuffix(results.quorum)}
                </span>{' '}
                Quorum
              </div>
            </div>
          )}
        </div>

        {/* Delegated Voting Power */}
        <div>
          {totalDelegatedVp && (
            <div className='mt-4'>
              <div
                className='border-neutral-350 relative h-2 w-full rounded-full border
                  dark:border-neutral-300'
              >
                <div
                  className='absolute top-0 left-0 h-full rounded-full bg-neutral-600 dark:bg-neutral-300'
                  style={{
                    width: `${participationPercentage}%`,
                  }}
                />
              </div>

              <div className='mt-2 text-xs'>
                <span className='font-semibold'>
                  {participationPercentage.toFixed(0)}%
                </span>{' '}
                of all delegated ARB has voted
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChoiceBarProps {
  choice: string;
  votingPower: number;
  color: string;
  percentage: number | null;
}

function ChoiceBar({ choice, votingPower, color, percentage }: ChoiceBarProps) {
  return (
    <div
      className='relative h-10 w-full rounded-lg border border-neutral-300 bg-white
        dark:border-neutral-700 dark:bg-neutral-950'
    >
      {/* Bar with percentage width */}
      <div
        className='absolute top-0 left-0 h-full rounded-lg'
        style={{
          width: `${percentage}%`,
          backgroundColor: color,
        }}
      />

      {/* Text content */}
      <div className='absolute inset-0 flex items-center justify-between px-3'>
        {/* Left side - Choice name */}
        <span className='max-w-[50%] truncate text-sm font-bold'>{choice}</span>

        {/* Right side - Percentage and voting power */}
        <span className='text-xs font-light'>
          {percentage === null ? '???%' : `${percentage.toFixed(1)}%`}{' '}
          <span className='font-bold'>
            {formatNumberWithSuffix(votingPower)}
          </span>
        </span>
      </div>
    </div>
  );
}

export function LoadingList() {
  return (
    <div
      className='ml-6 w-64 rounded-lg border border-neutral-300 bg-white p-4
        dark:border-neutral-700 dark:bg-neutral-950'
    >
      <h3 className='mb-4 text-xl font-semibold'>Vote Distribution</h3>
      <div className='space-y-4'>
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className='h-10 w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800'
          />
        ))}
      </div>
    </div>
  );
}
