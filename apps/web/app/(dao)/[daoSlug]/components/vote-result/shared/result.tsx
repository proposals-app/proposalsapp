import type { ProcessedResults } from '@/lib/results_processing';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';
import ArrowResultRightIcon from '@/public/assets/web/icons/arrow-right.svg';
import Link from 'next/link';
import type { VoteSegmentData } from '@/lib/types';
import type { ReactNode } from 'react';

interface ResultProps {
  content: string;
  timestamp: Date;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  resultNumber: number;
  daoSlug: string;
  groupId: string;
  live: boolean;
  expanded?: boolean;
  isMobile?: boolean;
  last?: boolean;
  showLink?: boolean;
  voteComponent?: ReactNode;
}

export function Result({
  content,
  result,
  resultNumber,
  groupId,
  live,
  expanded = true,
  isMobile = false,
  last = false,
  showLink = true,
  voteComponent,
}: ResultProps) {
  const onchain = result.proposal.blockCreatedAt ? true : false;

  const resultContent = (
    <div
      className={`${
        isMobile
          ? `group relative my-1 mr-4 flex w-full items-center`
          : showLink
            ? `flex w-full items-center`
            : `group flex w-full items-center`
      }`}
    >
      <div
        className={
          isMobile
            ? `${last ? 'border-neutral-800 dark:border-neutral-450' : 'border-neutral-400 dark:border-neutral-650'} rounded-xs flex h-full w-full border bg-white px-4 py-1 text-neutral-800 transition-transform duration-200 ease-in-out group-hover:-translate-x-1 dark:bg-neutral-950 dark:text-neutral-200`
            : `rounded-l-xs flex h-full w-full flex-col border-b border-l border-t border-neutral-400 bg-white px-1 py-1 text-neutral-800 transition-all duration-200 ease-in-out dark:border-neutral-650 dark:bg-neutral-950 dark:text-neutral-200`
        }
      >
        <div className='w-full'>
          <div className='flex w-full items-center'>
            {!isMobile && onchain ? (
              <OnchainEventIcon
                className='fill-neutral-800 dark:fill-neutral-350'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            ) : !isMobile ? (
              <OffchainEventIcon
                className='fill-neutral-800 dark:fill-neutral-350'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            ) : null}

            {(!isMobile || expanded) && (
              <div className='text-xs'>{content}</div>
            )}

            {live && (!isMobile || expanded) && (
              <div className='relative flex min-h-5 min-w-5 items-center justify-center sm:min-h-6 sm:min-w-6'>
                <span className='absolute inline-flex h-3 w-3 animate-ping rounded-full bg-for-400 opacity-75 dark:bg-for-600'></span>
                <span className='relative inline-flex h-2 w-2 rounded-full bg-for-400 dark:bg-for-600'></span>
              </div>
            )}

            {(!isMobile || expanded) && (
              <ArrowResultRightIcon
                className={`${isMobile ? 'ml-auto' : 'ml-auto mr-4'} fill-neutral-900 dark:fill-neutral-100`}
                width={24}
                height={24}
                alt={'Go to results'}
              />
            )}
          </div>

          <div className={`${isMobile ? 'text-sm' : 'px-4 text-sm'}`}>
            {voteComponent || <p>Invalid or unsupported vote type</p>}
          </div>
        </div>
      </div>
    </div>
  );

  if (showLink && !isMobile) {
    return (
      <Link
        className='group flex w-full transition-all duration-200 ease-in-out hover:-ml-1'
        href={`/${groupId}/vote/${resultNumber}`}
      >
        {resultContent}
      </Link>
    );
  }

  return resultContent;
}
