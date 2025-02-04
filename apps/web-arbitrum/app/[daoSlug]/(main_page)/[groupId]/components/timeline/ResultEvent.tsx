import Link from 'next/link';
import { ApprovalVote } from './ended_vote_types/ApprovalVote';
import { BasicVote } from './ended_vote_types/BasicVote';
import { QuadraticVote } from './ended_vote_types/QuadraticVote';
import { RankedChoiceVote } from './ended_vote_types/RankedChoiceVote';
import { SingleChoiceVote } from './ended_vote_types/SingleChoiceVote';
import { WeightedVote } from './ended_vote_types/WeightedVote';
import { ProcessedResults } from '@/lib/results_processing';
import Image from 'next/image';

interface ResultEventProps {
  content: string;
  timestamp: Date;
  result: ProcessedResults;
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
  daoSlug,
  groupId,
}: ResultEventProps) {
  const Component = result.voteType ? VoteComponents[result.voteType] : null;

  return (
    <div
      className={`relative mr-4 flex ${result.voteType == 'basic' && result.totalDelegatedVp ? 'h-32' : 'h-20'} my-1 w-full items-center`}
    >
      <div className='flex h-full w-full rounded-xs border border-neutral-400 bg-white px-4 py-1'>
        {last ? (
          <Image
            className='absolute top-1 left-1 z-20'
            src='/assets/web/timeline_event_active.svg'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        ) : (
          <Image
            className='absolute top-1 left-1 z-20'
            src='/assets/web/timeline_event.svg'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        )}
        {!last && (
          <div className='absolute top-0 left-3 z-10 h-[15px] max-h-[15px] w-0.5 translate-x-[3px] bg-neutral-800' />
        )}
        <Link
          className='w-full'
          href={`/${daoSlug}/${groupId}/results/${resultNumber}`} // Link to the results page
          prefetch={true}
        >
          <div className='flex w-full items-center justify-between pl-3'>
            <div className='text-xs'>{content}</div>

            <Image
              src='/assets/web/arrow_result_right.svg'
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
