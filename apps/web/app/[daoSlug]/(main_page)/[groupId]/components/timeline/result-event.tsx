import { ApprovalVote } from './ended_vote_types/approval-vote';
import { BasicVote } from './ended_vote_types/basic-vote';
import { QuadraticVote } from './ended_vote_types/quadratic-vote';
import { RankedChoiceVote } from './ended_vote_types/ranked-choice-vote';
import { SingleChoiceVote } from './ended_vote_types/single-choice-vote';
import { WeightedVote } from './ended_vote_types/weighted-vote';
import { ProcessedResults } from '@/lib/results_processing';
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg';
import TimelineEventActiveIcon from '@/public/assets/web/timeline_event_active.svg';
import ArrowResultRightIcon from '@/public/assets/web/arrow_result_right.svg';
import Link from 'next/link';

import { VoteSegmentData } from '../../actions';

interface ResultEventProps {
  content: string;
  timestamp: Date;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  resultNumber: number;
  last: boolean;
  daoSlug: string;
  groupId: string;
}

const VoteComponents = {
  'single-choice': SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  'ranked-choice': RankedChoiceVote,
} as const;

export function ResultEvent({
  content,
  result,
  resultNumber,
  last,
  groupId,
}: ResultEventProps) {
  const Component = result.voteType ? VoteComponents[result.voteType] : null;

  return (
    <div
      className={`relative mr-4 flex
        ${result.voteType == 'basic' && result.totalDelegatedVp ? 'h-32' : 'h-20'} group
        my-1 w-full items-center`}
    >
      <div
        className={`${last ? 'dark:border-neutral-450 border-neutral-800' : 'dark:border-neutral-650 border-neutral-400'}
          flex h-full w-full rounded-xs border bg-white px-4 py-1 text-neutral-800
          transition-transform duration-200 ease-in-out group-hover:-translate-x-1
          dark:bg-neutral-950 dark:text-neutral-200`}
      >
        {last ? (
          <TimelineEventActiveIcon
            className='dark:fill-neutral-350 absolute top-1 left-1 z-20 fill-neutral-800'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        ) : (
          <TimelineEventIcon
            className='dark:fill-neutral-350 absolute top-1 left-1 z-20 fill-neutral-800
              transition-opacity duration-200 ease-in-out group-hover:opacity-0'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        )}
        {!last && (
          <div
            className='dark:bg-neutral-350 absolute top-0 left-[15px] z-10 h-[15px] max-h-[15px] w-0.5
              bg-neutral-800 transition-opacity duration-200 ease-in-out group-hover:opacity-0'
          />
        )}
        <Link
          className='w-full'
          href={`/${groupId}/vote/${resultNumber}`}
          prefetch={true}
        >
          <div className='flex w-full items-center justify-between pl-3'>
            <div className='text-xs'>{content}</div>

            <ArrowResultRightIcon
              className='fill-neutral-900 dark:fill-neutral-100'
              width={24}
              height={24}
              alt={'Go to results'}
            />
          </div>
          <div className='text-sm'>
            {Component ? (
              <Component result={result} />
            ) : (
              <p>Invalid or unsupported vote type</p>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
