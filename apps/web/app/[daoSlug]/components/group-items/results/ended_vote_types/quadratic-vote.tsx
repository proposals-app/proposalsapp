import { VoteSegmentData } from '@/lib/types';
import { ProcessedResults } from '@/lib/results_processing';

interface QuadraticVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export const QuadraticVote = ({ result }: QuadraticVoteProps) => {
  return (
    <div>
      <h3>Quadratic Vote</h3>
      <p>Total Votes: {result.totalVotingPower}</p>
    </div>
  );
};
