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
    <div tw={`flex w-full items-center sm:w-96`}>
      <div tw='flex w-full'>
        <div
          tw={`h-full w-full flex flex-col rounded-l-xs text-neutral-800 transition-all duration-200 ease-in-out dark:text-neutral-200`}
        >
          <div tw='flex items-center'>
            {onchain ? (
              <OnchainEventIcon
                tw='dark:fill-neutral-350 fill-neutral-800'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            ) : (
              <OffchainEventIcon
                tw='dark:fill-neutral-350 fill-neutral-800'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            )}

            <div tw='text-xs'>{content}</div>
          </div>

          <div tw='px-1 text-sm flex'>
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
