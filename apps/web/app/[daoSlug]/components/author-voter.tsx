import { formatNumberWithSuffix } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export const VoterAuthor = ({
  voterAddress,
  ens,
  discourseUsername,
  avatar,
  currentVotingPower,
  eventVotingPower,
}: {
  voterAddress: string;
  ens: string | null;
  discourseUsername: string | null;
  avatar: string;
  currentVotingPower: number | null;
  eventVotingPower: number | null;
}) => {
  return (
    <Link
      href={`https://dune.com/entropy_advisors/arbitrum-dao-delegates?Delegate_t7d9d1=${voterAddress}#5-deep-dive-on-delegates`}
      target='_blank'
      className='flex items-center gap-2'
    >
      <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
        <Image
          src={avatar}
          className='rounded-full'
          fetchPriority='high'
          alt={voterAddress}
          width={40}
          height={40}
        />
      </div>
      <div className='flex flex-col text-neutral-800 dark:text-neutral-200'>
        {ens ? (
          <span className='truncate font-bold'>{ens}</span>
        ) : discourseUsername ? (
          <span className='truncate font-bold'>{discourseUsername}</span>
        ) : (
          <span className='truncate font-mono font-bold'>
            {voterAddress.slice(0, 6)}...{voterAddress.slice(-4)}
          </span>
        )}

        {currentVotingPower ? (
          <VotingPowerTag
            currentVotingPower={currentVotingPower}
            eventVotingPower={eventVotingPower}
          />
        ) : null}
      </div>
    </Link>
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
    eventVotingPower !== undefined && eventVotingPower !== null && eventVotingPower !== 0
      ? ((100 * currentVotingPower) / eventVotingPower) - 100
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
