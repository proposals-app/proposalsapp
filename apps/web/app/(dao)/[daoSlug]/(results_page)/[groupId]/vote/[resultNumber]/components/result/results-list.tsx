import { formatNumberWithSuffix } from '@/lib/utils';
import type { ProcessedResults } from '@/lib/results_processing';
import { toZonedTime } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import PassedIcon from '@/public/assets/web/icons/check.svg';
import FailedIcon from '@/public/assets/web/icons/cross.svg';
import superjson, { type SuperJSONResult } from 'superjson';
import { connection } from 'next/server';
import { SkeletonResultsList } from '@/app/components/ui/skeleton';

interface ResultsListProps {
  results: SuperJSONResult;
  onchain: boolean;
}

export function ResultsList({ results, onchain }: ResultsListProps) {
  const deserializedResults: ProcessedResults = superjson.deserialize(results);

  const explicitOrder = ['For', 'Abstain', 'Against'];

  const totalVotesCast = deserializedResults.totalVotingPower;
  const totalDelegatedVp = deserializedResults.totalDelegatedVp;

  // Calculate voting power for each choice using finalResults
  const choicesWithPower = deserializedResults.choices.map((choice, index) => ({
    choice,
    votingPower: deserializedResults.finalResults[index] || 0,
    color: deserializedResults.choiceColors[index],
    countsTowardsQuorum: deserializedResults.quorumChoices.includes(index),
  }));

  // Sort by voting power descending, respecting explicit order if provided
  const sortedChoices = explicitOrder
    ? choicesWithPower.sort((a, b) => {
        const indexA = explicitOrder.indexOf(a.choice);
        const indexB = explicitOrder.indexOf(b.choice);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // Fallback to sorting by power if not in explicitOrder
        return b.votingPower - a.votingPower;
      })
    : choicesWithPower.sort((a, b) => b.votingPower - a.votingPower);

  const quorumVotingPower = sortedChoices
    .filter((choice) => choice.countsTowardsQuorum)
    .reduce((sum, choice) => sum + choice.votingPower, 0);

  const participationPercentage = totalDelegatedVp
    ? (totalVotesCast / totalDelegatedVp) * 100
    : 0;

  // Determine which choices to show and the status message
  const majorityChoice = sortedChoices[0];
  const hasMajoritySupport = sortedChoices.map((c) => c.choice).includes('For')
    ? majorityChoice.choice === 'For' &&
      majorityChoice.votingPower > totalVotesCast / 2 // Majority based on votes cast
      ? true
      : false
    : undefined;

  const hasQuorum = quorumVotingPower > (deserializedResults.quorum || 0);

  return (
    <div className='flex w-72 flex-col gap-4 text-neutral-700 sm:ml-6 dark:text-neutral-200'>
      <div className='flex items-center sm:h-28'>
        <StatusMessage
          endTime={toZonedTime(deserializedResults.proposal.endAt, 'UTC')}
          hasQuorum={hasQuorum}
          isOnchain={onchain}
          hasMajoritySupport={hasMajoritySupport}
        />
      </div>
      {deserializedResults.quorum !== null && totalDelegatedVp && (
        <div className='flex flex-col gap-2'>
          <MajoritySupportCheckmark hasMajoritySupport={hasMajoritySupport} />
        </div>
      )}
      <ChoiceList choices={sortedChoices} totalVotingPower={totalVotesCast} />
      {deserializedResults.quorum !== null && totalDelegatedVp && (
        <div className='flex flex-col gap-2'>
          {deserializedResults.totalDelegatedVp && (
            <QuorumBar
              choices={sortedChoices.filter(
                (choice) => choice.countsTowardsQuorum
              )}
              quorumVotingPower={quorumVotingPower}
              quorum={deserializedResults.quorum}
              totalDelegatedVp={totalDelegatedVp}
            />
          )}
        </div>
      )}
      {totalDelegatedVp && (
        <ParticipationPercentage
          percentage={participationPercentage}
          actualVotesCast={totalVotesCast}
        />
      )}
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
        <span className='flex gap-2 font-mono text-xs font-light'>
          {percentage === null ? '???%' : `${percentage.toFixed(1)}%`}{' '}
          <span className='flex min-w-10 justify-end font-bold'>
            {formatNumberWithSuffix(votingPower)}
          </span>
        </span>
      </div>
    </div>
  );
}

interface StatusMessageProps {
  endTime: Date;
  hasQuorum: boolean;
  isOnchain: boolean;
  hasMajoritySupport?: boolean;
}

async function StatusMessage({
  endTime,
  hasQuorum,
  isOnchain,
  hasMajoritySupport,
}: StatusMessageProps) {
  await connection();
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
        <div className='text-sm font-medium'>
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
      <div className='text-sm font-medium'>
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
  // Check for majority support only if quorum is met, otherwise it's irrelevant
  if (!hasQuorum) {
    return (
      <div className='text-sm font-medium'>
        This {voteType} vote ends{' '}
        <span className='font-bold'>{timeString}</span> and{' '}
        <span className='font-bold'>is not reaching quorum</span>.
      </div>
    );
  }
  // Has quorum and is active
  return (
    <div className='text-sm font-medium'>
      This {voteType} vote ends <span className='font-bold'>{timeString}</span>{' '}
      {hasMajoritySupport !== undefined && (
        <>
          and is{' '}
          <span className='font-bold'>
            {hasMajoritySupport ? 'passing' : 'not passing'}
          </span>
        </>
      )}
      .
    </div>
  );
}

interface ChoiceListProps {
  choices: { choice: string; votingPower: number; color: string }[];
  totalVotingPower: number;
}

function ChoiceList({ choices, totalVotingPower }: ChoiceListProps) {
  return (
    <div className='space-y-2'>
      {choices.map(({ choice, votingPower, color }, index) => {
        // Calculate percentage based on total votes cast for all choices
        const percentage =
          totalVotingPower > 0 ? (votingPower / totalVotingPower) * 100 : 0;
        return (
          <ChoiceBar
            key={index}
            choice={choice}
            votingPower={votingPower}
            color={color}
            percentage={isNaN(percentage) ? null : percentage}
            choiceIndex={index}
            totalChoices={choices.length}
          />
        );
      })}
    </div>
  );
}

interface MajoritySupportCheckmarkProps {
  hasMajoritySupport: boolean | undefined;
}

function MajoritySupportCheckmark({
  hasMajoritySupport,
}: MajoritySupportCheckmarkProps) {
  return (
    <div className='flex w-full items-center gap-1 text-sm font-semibold'>
      {hasMajoritySupport === undefined ? null : hasMajoritySupport ? (
        <div className='flex items-center justify-center gap-1'>
          <PassedIcon className='fill-for-600 dark:fill-for-400' />
          <span>Majority support</span>
        </div>
      ) : (
        <div className='flex items-center justify-center gap-1'>
          <FailedIcon className='fill-against-600 dark:fill-against-400' />
          <span>No Majority support</span>
        </div>
      )}
    </div>
  );
}

interface QuorumBarProps {
  choices: { votingPower: number; color: string }[];
  quorumVotingPower: number;
  quorum: number;
  totalDelegatedVp: number;
}

function QuorumBar({
  choices,
  quorumVotingPower,
  quorum,
  totalDelegatedVp,
}: QuorumBarProps) {
  const quorumPercentage =
    totalDelegatedVp > 0 ? (quorum / totalDelegatedVp) * 100 : 0;

  return (
    <div>
      <div className='relative h-4 w-full'>
        {/* Quorum Line */}
        {quorumPercentage > 0 &&
          quorumPercentage <= 100 && ( // Only render line if within bounds
            <div
              className='absolute -top-1 z-10 h-6 w-0.5 bg-neutral-900 dark:bg-neutral-50'
              style={{
                left: `${quorumPercentage}%`,
              }}
              title={`Quorum: ${formatNumberWithSuffix(quorum)}`} // Add tooltip for clarity
            />
          )}
        {/* Choices that count towards quorum */}
        <div className='absolute inset-0 flex overflow-hidden border border-neutral-800 dark:border-neutral-200'>
          {choices.map((choice, index) => {
            const choiceWidthPercentage =
              totalDelegatedVp > 0
                ? (choice.votingPower / totalDelegatedVp) * 100
                : 0;
            return (
              <div
                key={index}
                className='h-full'
                style={{
                  width: `${choiceWidthPercentage}%`,
                  backgroundColor: choice.color,
                }}
                title={`${formatNumberWithSuffix(choice.votingPower)}`} // Add tooltip for clarity
              />
            );
          })}
        </div>
      </div>
      {/* Quorum Text */}
      <div className='mt-2 flex items-center gap-1 text-sm'>
        {quorumVotingPower > quorum ? (
          <PassedIcon className='fill-for-600 dark:fill-for-400' />
        ) : (
          <FailedIcon className='fill-against-600 dark:fill-against-400' />
        )}
        <span className='font-semibold'>
          {formatNumberWithSuffix(quorumVotingPower)}
        </span>
        <span>of</span>
        <span>{formatNumberWithSuffix(quorum)}</span>
        <span>Quorum</span>
      </div>
    </div>
  );
}

interface ParticipationPercentageProps {
  percentage: number;
  actualVotesCast: number;
}

function ParticipationPercentage({
  percentage,
  actualVotesCast,
}: ParticipationPercentageProps) {
  return (
    <div>
      <div className='relative h-2 w-full overflow-hidden border border-neutral-800 dark:border-neutral-200'>
        <div
          className='absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200'
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <div className='mt-2 text-xs'>
        <span className='font-semibold'>
          {formatNumberWithSuffix(actualVotesCast)}
        </span>{' '}
        ARB have voted ({percentage.toFixed(0)}% participation)
      </div>
    </div>
  );
}

export function LoadingList() {
  return <SkeletonResultsList />;
}
