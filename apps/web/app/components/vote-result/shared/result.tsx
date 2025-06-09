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
            ? `${last ? 'dark:border-neutral-450 border-neutral-800' : 'dark:border-neutral-650 border-neutral-400'} flex h-full w-full rounded-xs border bg-white px-4 py-1 text-neutral-800 transition-transform duration-200 ease-in-out group-hover:-translate-x-1 dark:bg-neutral-950 dark:text-neutral-200`
            : `dark:border-neutral-650 flex h-full w-full flex-col rounded-l-xs border-t border-b border-l border-neutral-400 bg-white px-1 py-1 text-neutral-800 transition-all duration-200 ease-in-out dark:bg-neutral-950 dark:text-neutral-200`
        }
      >
        <div className='w-full'>
          <div className='flex w-full items-center'>
            {!isMobile && onchain ? (
              <OnchainEventIcon
                className='dark:fill-neutral-350 fill-neutral-800'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            ) : !isMobile ? (
              <OffchainEventIcon
                className='dark:fill-neutral-350 fill-neutral-800'
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
                <span className='bg-for-400 dark:bg-for-600 absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-75'></span>
                <span className='bg-for-400 dark:bg-for-600 relative inline-flex h-2 w-2 rounded-full'></span>
              </div>
            )}

            {(!isMobile || expanded) && (
              <ArrowResultRightIcon
                className={`${isMobile ? 'ml-auto' : 'mr-4 ml-auto'} fill-neutral-900 dark:fill-neutral-100`}
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
