import { ApprovalVote } from './vote_types/approval-vote';
import { BasicVote } from './vote_types/basic-vote';
import { QuadraticVote } from './vote_types/quadratic-vote';
import { RankedChoiceVote } from './vote_types/ranked-choice-vote';
import { SingleChoiceVote } from './vote_types/single-choice-vote';
import { WeightedVote } from './vote_types/weighted-vote';
import { ProcessedResults } from '@/lib/results_processing';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';
import ArrowResultRightIcon from '@/public/assets/web/icons/arrow-right.svg';
import Link from 'next/link';
import { VoteSegmentData } from '@/lib/types';

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
}

const VoteComponents = {
  'single-choice': SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  'ranked-choice': RankedChoiceVote,
} as const;

export function Result({
  content,
  result,
  resultNumber,
  groupId,
  live,
}: ResultProps) {
  const Component = result.voteType ? VoteComponents[result.voteType] : null;

  const onchain = result.proposal.blockCreatedAt ? true : false;
  return (
    <div className={`group flex w-full items-center`}>
      <Link
        className='flex w-full transition-all duration-200 ease-in-out group-hover:-translate-x-1'
        href={`/${groupId}/vote/${resultNumber}`}
      >
        <div
          className={`dark:border-neutral-650 h-full w-full flex-col rounded-l-xs border-t border-b border-l border-neutral-400 bg-white px-1 py-1 text-neutral-800 group-hover:min-w-[calc(100%+0.25rem)] group-hover:pr-2 dark:bg-neutral-950 dark:text-neutral-200`}
        >
          <div className='flex items-center'>
            {onchain ? (
              <OnchainEventIcon
                className='dark:fill-neutral-350 fill-neutral-800'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            ) : (
              <OffchainEventIcon
                className='dark:fill-neutral-350 fill-neutral-800'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            )}

            <div className='text-xs'>{content}</div>

            {live && (
              <div className='relative flex min-h-5 min-w-5 items-center justify-center sm:min-h-6 sm:min-w-6'>
                <span className='bg-for-600 absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-75'></span>
                <span className='bg-for-600 relative inline-flex h-2 w-2 rounded-full'></span>
              </div>
            )}

            <ArrowResultRightIcon
              className='mr-4 ml-auto fill-neutral-900 dark:fill-neutral-100'
              width={24}
              height={24}
              alt={'Go to results'}
            />
          </div>

          <div className='px-4 text-sm'>
            {Component ? (
              <Component result={result} />
            ) : (
              <p>Invalid or unsupported vote type</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
