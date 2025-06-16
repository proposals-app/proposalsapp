import { Result as SharedResult } from '@/app/(dao)/[daoSlug]/components/vote-result/shared';
import {
  ApprovalVote,
  BasicVote,
  QuadraticVote,
  RankedChoiceVote,
  SingleChoiceVote,
  WeightedVote,
} from '@/app/(dao)/[daoSlug]/components/vote-result/web';
import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';

interface ResultProps {
  content: string;
  timestamp: Date;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  resultNumber: number;
  daoSlug: string;
  groupId: string;
  live: boolean;
}

const VoteComponents = {
  'single-choice': SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  'ranked-choice': RankedChoiceVote,
} as const;

export function Result(props: ResultProps) {
  const Component = props.result.voteType
    ? VoteComponents[props.result.voteType]
    : null;
  const voteComponent = Component ? <Component result={props.result} /> : null;

  return (
    <SharedResult
      {...props}
      isMobile={false}
      expanded={true}
      showLink={true}
      voteComponent={voteComponent}
    />
  );
}
