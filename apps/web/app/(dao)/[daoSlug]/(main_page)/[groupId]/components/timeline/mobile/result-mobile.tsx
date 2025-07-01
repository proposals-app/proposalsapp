import { Result as SharedResult } from '@/app/(dao)/[daoSlug]/components/vote-result/shared';
import {
  ApprovalVote,
  BasicVote,
  QuadraticVote,
  RankedChoiceVote,
  SingleChoiceVote,
  WeightedVote,
  HiddenVote,
} from '@/app/(dao)/[daoSlug]/components/vote-result/web';
import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';

interface ResultEventProps {
  content: string;
  timestamp: Date;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  resultNumber: number;
  last: boolean;
  daoSlug: string;
  groupId: string;
  expanded: boolean;
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

export function ResultEventMobile(props: ResultEventProps) {
  // Use HiddenVote component if votes are hidden and not finalized
  const isHidden =
    props.result.hiddenVote && props.result.scoresState !== 'final';
  const Component = isHidden
    ? HiddenVote
    : props.result.voteType
      ? VoteComponents[props.result.voteType]
      : null;
  const voteComponent = Component ? (
    <Component result={props.result} expanded={props.expanded} />
  ) : null;

  return (
    <SharedResult
      {...props}
      isMobile={true}
      showLink={false}
      voteComponent={voteComponent}
    />
  );
}
