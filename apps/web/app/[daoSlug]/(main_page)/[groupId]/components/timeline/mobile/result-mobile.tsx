import { ProcessedResults } from '@/lib/results_processing';
import ArrowResultRightIcon from '@/public/assets/web/icons/arrow-right.svg';
import { ApprovalVote } from './vote_types/approval-vote';
import { BasicVote } from './vote_types/basic-vote';
import { QuadraticVote } from './vote_types/quadratic-vote';
import { RankedChoiceVote } from './vote_types/ranked-choice-vote';
import { SingleChoiceVote } from './vote_types/single-choice-vote';
import { WeightedVote } from './vote_types/weighted-vote';
import { VoteSegmentData } from '@/lib/types';

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
  expanded: boolean;
  live: boolean;
}

const VoteComponents = {
  'single-choice': SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  'ranked-choice': RankedChoiceVote,
} as const;

export function ResultEventMobile({
  content,
  result,
  last,
  expanded,
  live,
}: ResultEventProps) {
  const Component = result.voteType ? VoteComponents[result.voteType] : null;

  return (
    <div className={`group relative my-1 mr-4 flex w-full items-center`}>
      <div
        className={`${last ? 'dark:border-neutral-450 border-neutral-800' : 'dark:border-neutral-650 border-neutral-400'} flex h-full w-full rounded-xs border bg-white px-4 py-1 text-neutral-800 transition-transform duration-200 ease-in-out group-hover:-translate-x-1 dark:bg-neutral-950 dark:text-neutral-200`}
      >
        <div className='w-full'>
          <div className='flex w-full items-center'>
            {expanded && <div className='text-xs'>{content}</div>}

            {expanded && live && (
              <div className='relative flex min-h-5 min-w-5 items-center justify-center sm:min-h-6 sm:min-w-6'>
                <span className='bg-for-600 absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-75'></span>
                <span className='bg-for-600 relative inline-flex h-2 w-2 rounded-full'></span>
              </div>
            )}

            {expanded && (
              <ArrowResultRightIcon
                className='ml-auto fill-neutral-900 dark:fill-neutral-100'
                width={24}
                height={24}
                alt={'Go to results'}
              />
            )}
          </div>
          <div className='text-sm'>
            {Component ? (
              <Component result={result} expanded={expanded} />
            ) : (
              <p>Invalid or unsupported vote type</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
