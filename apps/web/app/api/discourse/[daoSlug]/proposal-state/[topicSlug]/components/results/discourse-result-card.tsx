import type { VoteSegmentData } from '@/lib/types';
import {
  DiscourseApprovalVote,
  DiscourseBasicVote,
  DiscourseQuadraticVote,
  DiscourseRankedChoiceVote,
  DiscourseSingleChoiceVote,
  DiscourseWeightedVote,
} from '@/app/(dao)/[daoSlug]/components/vote-result/discourse';
import type { ProcessedResults } from '@/lib/results_processing';

interface DiscourseResultCardProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  debugBar?: boolean;
  currentTime?: Date;
  width?: number;
}

const DiscourseVoteComponents = {
  'single-choice': DiscourseSingleChoiceVote,
  weighted: DiscourseWeightedVote,
  approval: DiscourseApprovalVote,
  basic: DiscourseBasicVote,
  quadratic: DiscourseQuadraticVote,
  'ranked-choice': DiscourseRankedChoiceVote,
} as const;

export function DiscourseResultCard({
  result,
  debugBar = false,
  currentTime = new Date(),
  width,
}: DiscourseResultCardProps) {
  // Render vote component
  const renderVoteComponent = () => {
    if (result.voteType) {
      const DiscourseComponent = DiscourseVoteComponents[result.voteType];
      if (DiscourseComponent) {
        return (
          <DiscourseComponent
            result={result}
            debugBar={debugBar}
            currentTime={currentTime}
            width={width}
          />
        );
      }
    }

    return (
      <div style={{ padding: '8px', fontSize: '14px' }}>
        Invalid or unsupported vote type
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {renderVoteComponent()}
    </div>
  );
}
