import { ResultCard as SharedResultCard } from '@/app/(dao)/[daoSlug]/components/vote-result/shared';
import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';

interface ResultCardProps {
  content: string;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  currentTime?: Date;
}

export function ResultCard({ currentTime, ...props }: ResultCardProps) {
  return (
    <SharedResultCard {...props} useTw={false} currentTime={currentTime} />
  );
}
