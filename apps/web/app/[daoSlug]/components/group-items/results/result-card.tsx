import { ApprovalVote } from './ended_vote_types/approval-vote';
import { BasicVote } from './ended_vote_types/basic-vote';
import { QuadraticVote } from './ended_vote_types/quadratic-vote';
import { RankedChoiceVote } from './ended_vote_types/ranked-choice-vote';
import { SingleChoiceVote } from './ended_vote_types/single-choice-vote';
import { WeightedVote } from './ended_vote_types/weighted-vote';
import { ProcessedResults } from '@/lib/results_processing';
import { VoteSegmentData } from '@/app/[daoSlug]/(main_page)/[groupId]/actions';

interface ResultCardProps {
  content: string;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

const VoteComponents = {
  'single-choice': SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  'ranked-choice': RankedChoiceVote,
} as const;

export function ResultCard({ content, result }: ResultCardProps) {
  const Component = result.voteType ? VoteComponents[result.voteType] : null;

  return (
    <div
      className={`relative mr-4 flex ${result.voteType == 'basic' && result.totalDelegatedVp ? 'h-32' : 'h-20'} my-1 items-end`}
    >
      <div
        className={`dark:border-neutral-650 flex h-full w-full rounded-xs border border-neutral-400 bg-white px-4 py-1 text-neutral-800 transition-transform duration-200 ease-in-out dark:bg-neutral-950 dark:text-neutral-200`}
      >
        <div className='flex w-96 flex-col gap-2'>
          <div className='flex w-full items-center justify-between'>
            <div className='text-xs'>{content}</div>
          </div>
          <div className='text-sm'>
            {Component ? (
              <Component result={result} />
            ) : (
              <p>Invalid or unsupported vote type</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
