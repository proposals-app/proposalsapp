import { Selectable, Vote } from '@proposalsapp/db';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ApprovalVote } from './ended_vote_types/ApprovalVote';
import { BasicVote } from './ended_vote_types/BasicVote';
import { QuadraticVote } from './ended_vote_types/QuadraticVote';
import { RankedChoiceVote } from './ended_vote_types/RankedChoiceVote';
import { SingleChoiceVote } from './ended_vote_types/SingleChoiceVote';
import { WeightedVote } from './ended_vote_types/WeightedVote';
import { ProposalWithMetadata } from '@/app/types';

interface ResultEventProps {
  content: string;
  timestamp: Date;
  proposal: ProposalWithMetadata;
  votes: Selectable<Vote>[];
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
  proposal,
  votes,
  resultNumber,
  last,
  daoSlug,
  groupId,
}: ResultEventProps) {
  const Component = proposal.metadata.voteType
    ? VoteComponents[proposal.metadata.voteType]
    : null;

  return (
    <Link
      className='w-full'
      href={`/${daoSlug}/${groupId}/results/${resultNumber}`} // Link to the results page
      prefetch={true}
    >
      <div className='relative flex w-full items-center py-2'>
        <div
          className='flex w-full flex-col gap-1 rounded-l-xl border border-neutral-300 bg-white px-4
            py-2 pr-8 dark:border-neutral-700 dark:bg-neutral-950'
        >
          <div className='absolute top-5 left-3 z-20 h-[7px] w-[7px] rounded-full bg-neutral-500' />
          {!last && (
            <div
              className='absolute top-[7px] left-3 z-10 h-[15px] max-h-[15px] w-0.5 translate-x-[2.5px]
                bg-neutral-500'
            />
          )}
          <div className='ml-2 flex w-full items-center justify-between'>
            <div className='text-xs'>{content}</div>

            <ArrowRight size={14} />
          </div>
          <div className='ml-2 text-sm'>
            {Component ? (
              <Component proposal={proposal} votes={votes} />
            ) : (
              <p>Invalid or unsupported vote type</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
