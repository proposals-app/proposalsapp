import { formatNumberWithSuffix } from '@/lib/utils';
import { ProcessedResults } from '@/lib/results_processing';
import { toZonedTime } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import { JSX } from 'react';
import PassedIcon from '@/public/assets/web/passed.svg';
import FailedIcon from '@/public/assets/web/failed.svg';

interface ResultsListProps {
  results: ProcessedResults;
  onchain: boolean;
}

export function ResultsList({ results, onchain }: ResultsListProps) {
  const explicitOrder = ['For', 'Abstain', 'Against'];
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
  const sortedChoices = explicitOrder
    ? choicesWithPower.sort((a, b) => {
        const indexA = explicitOrder.indexOf(a.choice);
        const indexB = explicitOrder.indexOf(b.choice);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        return b.votingPower - a.votingPower;
      })
    : choicesWithPower.sort((a, b) => b.votingPower - a.votingPower);

  // Determine which choices to show

  const quorumVotingPower = sortedChoices
    .filter((choice) => choice.countsTowardsQuorum)
    .reduce((sum, choice) => sum + choice.votingPower, 0);

  const participationPercentage = totalDelegatedVp
    ? (totalVotingPower / totalDelegatedVp) * 100
    : 0;

  // Find the choice with the highest voting power
  const majorityChoice = sortedChoices[0];

  // Check if the majority choice is "For"
  const hasMajoritySupport = sortedChoices.map((c) => c.choice).includes('For')
    ? majorityChoice.choice === 'For' &&
      majorityChoice.votingPower > totalVotingPower / 2
      ? true
      : false
    : undefined;

  const hasQuorum = quorumVotingPower > (results.quorum || 0);

  const statusMessage = getStatusMessage(
    toZonedTime(results.proposal.endAt, 'UTC'),
    hasQuorum,
    onchain,
    hasMajoritySupport
  );

  return (
    <div className='ml-6 w-72 text-neutral-700 dark:text-neutral-200'>
      {statusMessage && (
        <div className='mb-4 text-sm font-medium'>{statusMessage}</div>
      )}

      <div className='space-y-4'>
        <div className='space-y-2'>
          {sortedChoices.map(({ choice, votingPower, color }, index) => {
            const percentage = (votingPower / totalVotingPower) * 100;
            return (
              <ChoiceBar
                key={index}
                choice={choice}
                votingPower={votingPower}
                color={color}
                percentage={isNaN(percentage) ? null : percentage}
                choiceIndex={index}
                totalChoices={sortedChoices.length}
              />
            );
          })}
        </div>

        {/* Majority Support Checkmark */}
        {results.quorum !== null && totalDelegatedVp && (
          <div
            className='flex w-full items-center gap-1 text-sm font-semibold'
            style={{
              left: `${(results.quorum / totalDelegatedVp) * 100}%`,
            }}
          >
            {hasMajoritySupport ? <PassedIcon /> : <FailedIcon />}
            <span>Majority support</span>
          </div>
        )}

        {/* Quorum Bar */}
        <div>
          {results.quorum !== null && totalDelegatedVp && (
            <div className='mb-4'>
              <div className='relative h-4 w-full'>
                {/* Quorum Line */}
                <div
                  className='absolute -top-1 z-10 h-6 w-0.5 bg-neutral-900 dark:bg-neutral-50'
                  style={{
                    left: `${(results.quorum / totalDelegatedVp) * 100}%`,
                  }}
                />

                {/* Choices that count towards quorum */}
                <div className='absolute inset-0 flex border border-neutral-800 dark:border-neutral-200'>
                  {sortedChoices
                    .filter((choice) => choice.countsTowardsQuorum)
                    .map((choice, index) => (
                      <div
                        key={index}
                        className='h-full'
                        style={{
                          width: `${(choice.votingPower / totalDelegatedVp) * 100}%`,
                          backgroundColor: choice.color,
                        }}
                      />
                    ))}
                </div>
              </div>
              {/* Quorum Text */}
              <div className='mt-2 flex items-center gap-1 text-sm'>
                {quorumVotingPower > results.quorum ? (
                  <PassedIcon />
                ) : (
                  <FailedIcon />
                )}
                <span className='font-semibold'>
                  {formatNumberWithSuffix(quorumVotingPower)}
                </span>
                <span>of</span>
                <span>{formatNumberWithSuffix(results.quorum)}</span>
                <span>Quorum</span>
              </div>
            </div>
          )}
        </div>

        {/* Delegated Voting Power */}
        <div>
          {totalDelegatedVp && (
            <div className='mt-4'>
              <div className='relative h-2 w-full border border-neutral-800 dark:border-neutral-200'>
                <div
                  className='absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200'
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
  choiceIndex: number;
  totalChoices: number;
}

function ChoiceBar({ choice, votingPower, color, percentage }: ChoiceBarProps) {
  return (
    <div
      className={'relative h-10 w-full overflow-hidden border'}
      style={{
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: color,
      }}
    >
      {/* Filled bar */}
      {percentage !== null && (
        <div
          className='absolute inset-y-0 left-0 h-full'
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            opacity: 0.5,
          }}
        />
      )}

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

function getStatusMessage(
  endTime: Date,
  hasQuorum: boolean,
  isOnchain: boolean,
  hasMajoritySupport?: boolean
): JSX.Element {
  const now = new Date();
  const isEnded = now > endTime;
  const voteType = isOnchain ? 'onchain' : 'offchain';

  const timeString = isEnded
    ? `${formatDistanceToNow(endTime)} ago`
    : `in ${formatDistanceToNow(endTime)}`;

  // Vote has ended
  if (isEnded) {
    if (!hasQuorum) {
      return (
        <div className='mb-4 text-sm font-medium'>
          This {voteType} vote ended{' '}
          <span className='font-bold'>{timeString}</span> and{' '}
          <span className='font-bold'>
            did not pass due to insufficient quorum
          </span>
          .
        </div>
      );
    }
    // Has quorum and ended
    return (
      <div className='mb-4 text-sm font-medium'>
        This {voteType} vote ended{' '}
        <span className='font-bold'>{timeString}</span>
        {hasMajoritySupport !== undefined && (
          <>
            {' '}
            and{' '}
            <span className='font-bold'>
              {hasMajoritySupport ? 'passed' : 'did not pass'}
            </span>
          </>
        )}
        .
      </div>
    );
  }

  // Vote is still active
  if (!hasQuorum) {
    return (
      <div className='mb-4 text-sm font-medium'>
        This {voteType} vote ends{' '}
        <span className='font-bold'>{timeString}</span> and{' '}
        <span className='font-bold'>is not reaching quorum</span>.
      </div>
    );
  }
  // Has quorum and is active
  return (
    <div className='mb-4 text-sm font-medium'>
      This {voteType} vote ends <span className='font-bold'>{timeString}</span>{' '}
      and is{' '}
      <span className='font-bold'>
        {hasMajoritySupport ? 'passing' : 'not passing'}
      </span>
      .
    </div>
  );
}

export function LoadingList() {
  return (
    <div className='ml-6 w-72 text-neutral-700 dark:text-neutral-200'>
      {/* Status message placeholder */}
      <div className='mb-4 h-5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />

      <div className='space-y-4'>
        {/* Choice bars loading state */}
        <div className='space-y-2'>
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className='relative h-10 w-full animate-pulse overflow-hidden border-2 border-neutral-200
                dark:border-neutral-700'
            />
          ))}
        </div>

        {/* Majority support placeholder */}
        <div className='flex w-full items-center gap-1'>
          <div className='h-4 w-4 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>

        {/* Quorum bar placeholder */}
        <div>
          <div className='mb-4'>
            <div
              className='relative h-4 w-full overflow-hidden border border-neutral-200
                dark:border-neutral-700'
            >
              <div className='h-full w-1/2 animate-pulse bg-neutral-200 dark:bg-neutral-700' />
            </div>
            {/* Quorum text placeholder */}
            <div className='mt-2 flex items-center gap-1'>
              <div className='h-4 w-4 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700' />
              <div className='h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
            </div>
          </div>
        </div>

        {/* Delegated voting power placeholder */}
        <div className='mt-4'>
          <div className='relative h-2 w-full border border-neutral-200 dark:border-neutral-700'>
            <div className='h-full w-1/3 animate-pulse bg-neutral-200 dark:bg-neutral-700' />
          </div>
          <div className='mt-2 flex items-center gap-1'>
            <div className='h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          </div>
        </div>
      </div>
    </div>
  );
}
