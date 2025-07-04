import { formatNumberWithSuffix } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

export interface VotingPowerTagProps {
  currentVotingPower: number | null;
  eventVotingPower?: number | null;
}

export function VotingPowerTag({
  currentVotingPower,
  eventVotingPower,
}: VotingPowerTagProps) {
  if (!currentVotingPower) return null;

  // Fixed calculation: use the mathematically correct formula
  const percentageChange =
    eventVotingPower !== undefined &&
    eventVotingPower !== null &&
    eventVotingPower !== 0
      ? ((currentVotingPower - eventVotingPower) / eventVotingPower) * 100
      : undefined;

  const shouldShowChange =
    percentageChange !== undefined && Math.abs(percentageChange) >= 0.1;

  return (
    <div className='flex gap-1'>
      <div className='border-neutral-350 text-neutral-650 dark:text-neutral-350 flex w-fit cursor-default gap-4 rounded-xs border bg-neutral-100 p-0.5 px-2 text-xs font-normal dark:border-neutral-600 dark:bg-neutral-900'>
        <div className='flex gap-2'>
          {formatNumberWithSuffix(currentVotingPower)} ARB
        </div>
      </div>
      {shouldShowChange ? (
        <span className={'flex items-center gap-0.5 text-xs font-normal'}>
          {percentageChange > 0 ? '+' : ''}
          {percentageChange.toFixed(1)}%
          {percentageChange > 0 ? (
            <ArrowUpIcon className='text-for-600 inline-block h-3 w-3' />
          ) : null}
          {percentageChange < 0 ? (
            <ArrowDownIcon className='text-against-600 inline-block h-3 w-3' />
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
