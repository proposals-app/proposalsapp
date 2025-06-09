import type { ProcessedResults } from '@/lib/results_processing';
import { formatNumberWithSuffix } from '@/lib/utils';
import type { VoteSegmentData } from '@/lib/types';

interface HiddenVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  expanded?: boolean;
}

export function HiddenVote({
  result,
  expanded: _expanded = true,
}: HiddenVoteProps) {
  return (
    <div className='flex-col items-center justify-between'>
      <div className='flex h-4 w-full overflow-hidden' />
      <div className='flex w-full justify-between'>
        <div className='text-sm font-bold'>Hidden Votes</div>
        <div className='text-sm'>
          {formatNumberWithSuffix(result.totalVotingPower)}
        </div>
      </div>
    </div>
  );
}
