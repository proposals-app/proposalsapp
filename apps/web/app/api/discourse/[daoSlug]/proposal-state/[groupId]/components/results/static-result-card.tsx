import type { VoteSegmentData } from '@/lib/types';
import {
  ApprovalVoteStatic,
  BasicVoteStatic,
  QuadraticVoteStatic,
  RankedChoiceVoteStatic,
  SingleChoiceVoteStatic,
  WeightedVoteStatic,
} from '@/app/components/vote-result/static';
import type { ProcessedResults } from '@/lib/results_processing';

interface StaticResultCardProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  debugBar?: boolean;
}

const VoteComponentsStatic = {
  'single-choice': SingleChoiceVoteStatic,
  weighted: WeightedVoteStatic,
  approval: ApprovalVoteStatic,
  basic: BasicVoteStatic,
  quadratic: QuadraticVoteStatic,
  'ranked-choice': RankedChoiceVoteStatic,
} as const;

export function StaticResultCard({
  result,
  debugBar = false,
}: StaticResultCardProps) {
  // Render vote component
  const renderVoteComponent = () => {
    if (result.voteType) {
      const StaticComponent = VoteComponentsStatic[result.voteType];
      if (StaticComponent) {
        return <StaticComponent result={result} debugBar={debugBar} />;
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
