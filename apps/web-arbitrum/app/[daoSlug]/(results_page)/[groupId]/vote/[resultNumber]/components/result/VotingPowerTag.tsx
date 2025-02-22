'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { DelegateVotingPower } from '../actions';

interface VotingPowerTagProps {
  votingPower: DelegateVotingPower;
}

export function VotingPowerTag({ votingPower }: VotingPowerTagProps) {
  if (!votingPower) return null;

  return (
    <div
      className='border-neutral-350 text-neutral-650 dark:text-neutral-350 flex w-fit
        cursor-default gap-4 rounded-xs border bg-neutral-100 p-0.5 px-2 text-xs
        font-normal dark:border-neutral-600 dark:bg-neutral-900'
    >
      <div className='flex gap-2'>
        {formatNumberWithSuffix(votingPower.latestVotingPower)} ARB
        {votingPower.change !== null && (
          <div className='flex items-center gap-1'>
            <div>{votingPower.change.toFixed(2)} %</div>
            {votingPower.change > 0 ? <div>↑</div> : <div>↓</div>}
          </div>
        )}
      </div>
    </div>
  );
}
