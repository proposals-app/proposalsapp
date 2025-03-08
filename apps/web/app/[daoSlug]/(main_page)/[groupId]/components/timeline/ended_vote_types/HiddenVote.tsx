import { ProcessedResults } from '@/lib/results_processing';
import { formatNumberWithSuffix } from '@/lib/utils';
import { VoteSegmentData } from '../actions';

interface HiddenVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export function HiddenVote({ result }: HiddenVoteProps) {
  return (
    <div className='flex-col items-center justify-between space-y-1'>
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
