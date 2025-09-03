import { formatNumberWithSuffix } from '@/lib/utils';
import type { ProcessedResults } from '@/lib/results_processing';
import { toZonedTime } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import PassedIcon from '@/public/assets/web/icons/check.svg';
import FailedIcon from '@/public/assets/web/icons/cross.svg';
import superjson, { type SuperJSONResult } from 'superjson';
import { SkeletonResultsList } from '@/app/components/ui/skeleton';

interface ResultsListProps {
  results: SuperJSONResult;
  onchain: boolean;
}

export function ResultsList({ results, onchain }: ResultsListProps) {
  const deserializedResults: ProcessedResults = superjson.deserialize(results);

  const explicitOrder = ['For', 'Abstain', 'Against'];

  const totalVotesCast = deserializedResults.totalVotingPower;

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

  // Participation bars are rendered in ResultsListBars; no local computation needed here

  // Determine which choices to show and the status message
  const majorityChoice = sortedChoices[0];
  const hasMajoritySupport = sortedChoices.map((c) => c.choice).includes('For')
    ? majorityChoice.choice === 'For' &&
      majorityChoice.votingPower > totalVotesCast / 2 // Majority based on votes cast
      ? true
      : false
    : undefined;

  const hasQuorum = quorumVotingPower > (deserializedResults.quorum || 0);

  // Bars are now rendered separately in ResultsListBars to avoid coupling

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
      <ChoiceList choices={sortedChoices} totalVotingPower={totalVotesCast} />
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

function StatusMessage({
  endTime,
  hasQuorum,
  isOnchain,
  hasMajoritySupport,
}: StatusMessageProps) {
  const now = new Date();
  const isEnded = now > endTime;
  const voteType = isOnchain ? 'onchain' : 'offchain';

  const timeString = isEnded
    ? `${formatDistanceToNow(endTime)} ago`
    : `in ${formatDistanceToNow(endTime)}`;

  // Vote has ended
  if (isEnded) {
    // Onchain specific: mention quorum failure
    if (isOnchain && !hasQuorum) {
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
  if (isOnchain && !hasQuorum) {
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

export function MajoritySupportCheckmark({
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

export function QuorumBar({
  choices,
  quorumVotingPower,
  quorum,
  totalDelegatedVp,
}: QuorumBarProps) {
  // Denominator is the total delegated VP at proposal start
  const denominator =
    totalDelegatedVp && totalDelegatedVp > 0 ? totalDelegatedVp : 0;
  const quorumPercentage = denominator
    ? Math.min(100, (quorum / denominator) * 100)
    : 0;

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
            const choiceWidthPercentage = denominator
              ? Math.min(100, (choice.votingPower / denominator) * 100)
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

export function ParticipationPercentage({
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

// Stream-only bars component that can be rendered after the list
export function ResultsListBars({
  results,
  onchain,
}: {
  results: SuperJSONResult;
  onchain: boolean;
}) {
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

  // Sort by explicit order, otherwise by power desc
  const sortedChoices = explicitOrder
    ? choicesWithPower.sort((a, b) => {
        const indexA = explicitOrder.indexOf(a.choice);
        const indexB = explicitOrder.indexOf(b.choice);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        return b.votingPower - a.votingPower;
      })
    : choicesWithPower.sort((a, b) => b.votingPower - a.votingPower);

  const quorumVotingPower = sortedChoices
    .filter((choice) => choice.countsTowardsQuorum)
    .reduce((sum, choice) => sum + choice.votingPower, 0);

  const hasStartDelegatedVp = Boolean(totalDelegatedVp && totalDelegatedVp > 0);
  const showQuorumBar = Boolean(
    onchain && deserializedResults.quorum !== null && hasStartDelegatedVp
  );
  const showParticipationBar = hasStartDelegatedVp;

  const majorityChoice = sortedChoices[0];
  const hasMajoritySupport = sortedChoices.map((c) => c.choice).includes('For')
    ? majorityChoice.choice === 'For' &&
      majorityChoice.votingPower > totalVotesCast / 2
      ? true
      : false
    : undefined;

  return (
    <div className='mt-4 flex min-h-[112px] w-72 flex-col gap-2 text-neutral-700 sm:ml-6 dark:text-neutral-200'>
      {deserializedResults.quorum !== null && totalDelegatedVp && (
        <MajoritySupportCheckmark hasMajoritySupport={hasMajoritySupport} />
      )}
      {showQuorumBar && (
        <QuorumBar
          choices={sortedChoices.filter((c) => c.countsTowardsQuorum)}
          quorumVotingPower={quorumVotingPower}
          quorum={deserializedResults.quorum as number}
          totalDelegatedVp={totalDelegatedVp ?? 0}
        />
      )}
      {showParticipationBar && (
        <ParticipationPercentage
          percentage={
            totalDelegatedVp
              ? Math.min(100, (totalVotesCast / totalDelegatedVp) * 100)
              : 0
          }
          actualVotesCast={totalVotesCast}
        />
      )}
    </div>
  );
}

// Skeleton to occupy exact space of bars to avoid CLS - matches real components exactly
export function ResultsListBarsSkeleton() {
  return (
    <div className='mt-4 flex min-h-[112px] w-72 flex-col gap-2 text-neutral-700 sm:ml-6 dark:text-neutral-200'>
      {/* Majority support row - matches MajoritySupportCheckmark */}
      <div className='flex w-full items-center gap-1 text-sm font-semibold'>
        {/* Icon skeleton - SVG is 24x24 but rendered at different size via CSS */}
        <div className='skeleton-blueprint skeleton-text h-6 w-6' />
        <div className='skeleton-blueprint skeleton-text h-4 w-32' />
      </div>
      {/* Quorum bar - matches QuorumBar */}
      <div>
        <div className='relative h-4 w-full'>
          <div className='absolute inset-0 flex overflow-hidden border border-neutral-300 dark:border-neutral-700'>
            <div className='skeleton-blueprint skeleton-text h-full w-1/3' />
          </div>
        </div>
        {/* Quorum Text */}
        <div className='mt-2 flex items-center gap-1 text-sm'>
          {/* Icon - same size as check/cross icons */}
          <div className='skeleton-blueprint skeleton-text h-6 w-6' />
          <span className='skeleton-blueprint skeleton-text h-4 w-16 font-semibold' />
          <span className='skeleton-blueprint skeleton-text h-4 w-6' />
          <span className='skeleton-blueprint skeleton-text h-4 w-12' />
          <span className='skeleton-blueprint skeleton-text h-4 w-12' />
        </div>
      </div>
      {/* Participation bar - matches ParticipationPercentage */}
      <div>
        <div className='relative h-2 w-full overflow-hidden border border-neutral-300 dark:border-neutral-700'>
          <div className='skeleton-blueprint skeleton-text absolute top-0 left-0 h-full w-1/2' />
        </div>
        <div className='mt-2 text-xs'>
          <span className='skeleton-blueprint skeleton-text inline-block h-3 w-12 font-semibold' />
          <span className='skeleton-blueprint skeleton-text ml-1 inline-block h-3 w-40' />
        </div>
      </div>
    </div>
  );
}
