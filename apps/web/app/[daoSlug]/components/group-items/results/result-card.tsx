import { VoteSegmentData } from '@/lib/types';
import { ApprovalVote } from './ended_vote_types/approval-vote';
import { BasicVote } from './ended_vote_types/basic-vote';
import { QuadraticVote } from './ended_vote_types/quadratic-vote';
import { RankedChoiceVote } from './ended_vote_types/ranked-choice-vote';
import { SingleChoiceVote } from './ended_vote_types/single-choice-vote';
import { WeightedVote } from './ended_vote_types/weighted-vote';
import { ProcessedResults } from '@/lib/results_processing';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';

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

  const onchain = result.proposal.blockCreatedAt ? true : false;
  return (
    <div className={`flex w-full items-center sm:w-96`}>
      <div className='flex w-full'>
        <div
          className={`dark:border-neutral-650 h-full w-full flex-col rounded-l-xs border border-neutral-400 bg-white px-1 py-1 text-neutral-800 transition-all duration-200 ease-in-out dark:bg-neutral-950 dark:text-neutral-200`}
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
          </div>

          <div className='px-1 text-sm'>
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
