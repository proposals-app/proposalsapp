import Image from 'next/image';
import Link from 'next/link';
import { VotingPowerTag } from './voting-power-tag';

export interface AuthorCardProps {
  href: string;
  avatar: string;
  altText: string;
  primaryName: string;
  secondaryName?: string;
  nameDisplayType?: 'discourse' | 'voter';
  currentVotingPower?: number | null;
  eventVotingPower?: number | null;
}

export function AuthorCard({
  href,
  avatar,
  altText,
  primaryName,
  secondaryName,
  nameDisplayType = 'discourse',
  currentVotingPower,
  eventVotingPower,
}: AuthorCardProps) {
  return (
    <Link href={href} target='_blank' className='flex items-center gap-2'>
      <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
        <Image
          src={avatar}
          className='rounded-full'
          fetchPriority='high'
          alt={altText}
          width={40}
          height={40}
        />
      </div>
      <div className='flex flex-col text-neutral-800 dark:text-neutral-200'>
        {nameDisplayType === 'discourse' && secondaryName ? (
          <div>
            <span className='font-bold'>{primaryName}</span>
            <span className='text-neutral-450'> from </span>
            <span className='font-bold text-neutral-450 dark:text-neutral-350'>
              {secondaryName}
            </span>
          </div>
        ) : (
          <span
            className={`truncate font-bold ${nameDisplayType === 'voter' && primaryName.includes('...') ? 'font-mono' : ''}`}
          >
            {primaryName}
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
}
