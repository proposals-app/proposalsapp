import { formatNumberWithSuffix } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import Image from 'next/image';

export const DiscourseAuthor = ({
  username,
  ens,
  avatar,
  currentVotingPower,
  eventVotingPower,
}: {
  username: string;
  ens: string | null | undefined;
  avatar: string;
  currentVotingPower: number | null | undefined;
  eventVotingPower: number | null;
}) => {
  return (
    <div className='flex items-center gap-2'>
      <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
        <Image
          src={
            avatar ||
            `https://api.dicebear.com/9.x/pixel-art/png?seed=${username}`
          }
          className='rounded-full'
          fetchPriority='high'
          alt={username}
          width={40}
          height={40}
        />
      </div>
      <div className='flex flex-col text-neutral-800 dark:text-neutral-200'>
        {ens ? (
          <div>
            <span className='font-bold'>{username}</span>
            <span className='text-neutral-450'> from </span>
            <span className='dark:text-neutral-350 text-neutral-450 font-bold'>
              {ens}
            </span>
          </div>
        ) : (
          <span className='font-bold'>{username}</span>
        )}

        {currentVotingPower ? (
          <VotingPowerTag
            currentVotingPower={currentVotingPower}
            eventVotingPower={eventVotingPower}
          />
        ) : null}
      </div>
    </div>
  );
};

export function VotingPowerTag({
  currentVotingPower,
  eventVotingPower,
}: {
  currentVotingPower: number | null; // Changed type to number | null
  eventVotingPower?: number | null;
}) {
  if (!currentVotingPower) return null;

  const percentageChange =
    eventVotingPower !== undefined && eventVotingPower !== null
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
