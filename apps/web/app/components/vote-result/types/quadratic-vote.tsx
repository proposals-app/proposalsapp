import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';

interface QuadraticVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  expanded?: boolean;
}

export const QuadraticVote = ({
  result,
  expanded: _expanded = true,
}: QuadraticVoteProps) => {
  return (
    <div>
      <h3>Quadratic Vote</h3>
      <p>Total Votes: {result.totalVotingPower}</p>
    </div>
  );
};
