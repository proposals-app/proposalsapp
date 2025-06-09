import type { VoteSegmentData } from '@/lib/types';
import {
  ApprovalVote,
  BasicVote,
  QuadraticVote,
  RankedChoiceVote,
  SingleChoiceVote,
  WeightedVote,
} from '@/app/components/vote-result/types';
import {
  ApprovalVoteStatic,
  BasicVoteStatic,
  QuadraticVoteStatic,
  RankedChoiceVoteStatic,
  SingleChoiceVoteStatic,
  WeightedVoteStatic,
} from '@/app/components/vote-result/static';
import type { ProcessedResults } from '@/lib/results_processing';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';
import type { ReactNode } from 'react';

interface ResultCardProps {
  content: string;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  useTw?: boolean;
  voteComponent?: ReactNode;
}

const VoteComponents = {
  'single-choice': SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  'ranked-choice': RankedChoiceVote,
} as const;

const VoteComponentsStatic = {
  'single-choice': SingleChoiceVoteStatic,
  weighted: WeightedVoteStatic,
  approval: ApprovalVoteStatic,
  basic: BasicVoteStatic,
  quadratic: QuadraticVoteStatic,
  'ranked-choice': RankedChoiceVoteStatic,
} as const;

export function ResultCard({
  content,
  result,
  useTw = false,
  voteComponent,
}: ResultCardProps) {
  const Component = result.voteType ? VoteComponents[result.voteType] : null;
  const onchain = result.proposal.blockCreatedAt ? true : false;

  // Choose styling approach based on useTw prop
  const containerStyle = useTw
    ? `flex w-full items-center sm:w-96`
    : `flex w-full items-center sm:w-96`;

  const innerContainerStyle = useTw ? 'flex w-full' : 'flex w-full';

  const contentWrapperStyle = useTw
    ? `h-full w-full flex flex-col rounded-l-xs text-neutral-800 transition-all duration-200 ease-in-out dark:text-neutral-200`
    : `h-full w-full flex-col rounded-l-xs text-neutral-800 transition-all duration-200 ease-in-out dark:text-neutral-200`;

  const headerStyle = useTw ? 'flex items-center' : 'flex items-center';

  const iconStyle = useTw
    ? 'dark:fill-neutral-350 fill-neutral-800'
    : 'dark:fill-neutral-350 fill-neutral-800';

  const textStyle = useTw ? 'text-xs' : 'text-xs';

  const voteWrapperStyle = useTw ? 'px-1 text-sm flex' : 'px-1 text-sm';

  // Render vote component with appropriate styling
  const renderVoteComponent = () => {
    if (voteComponent) {
      return voteComponent;
    }

    if (useTw && result.voteType) {
      // Use static components for ImageResponse
      const StaticComponent = VoteComponentsStatic[result.voteType];
      if (StaticComponent) {
        return <StaticComponent result={result} />;
      }
    } else if (Component) {
      // Use regular components with hooks for normal rendering
      return <Component result={result} />;
    }

    return <p>Invalid or unsupported vote type</p>;
  };

  if (useTw) {
    return (
      <div tw={containerStyle}>
        <div tw={innerContainerStyle}>
          <div tw={contentWrapperStyle}>
            <div tw={headerStyle}>
              {onchain ? (
                <OnchainEventIcon
                  tw={iconStyle}
                  width={24}
                  height={24}
                  alt={'Timeline event'}
                />
              ) : (
                <OffchainEventIcon
                  tw={iconStyle}
                  width={24}
                  height={24}
                  alt={'Timeline event'}
                />
              )}
              <div tw={textStyle}>{content}</div>
            </div>
            <div tw={voteWrapperStyle}>{renderVoteComponent()}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerStyle}>
      <div className={innerContainerStyle}>
        <div className={contentWrapperStyle}>
          <div className={headerStyle}>
            {onchain ? (
              <OnchainEventIcon
                className={iconStyle}
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            ) : (
              <OffchainEventIcon
                className={iconStyle}
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            )}
            <div className={textStyle}>{content}</div>
          </div>
          <div className={voteWrapperStyle}>{renderVoteComponent()}</div>
        </div>
      </div>
    </div>
  );
}
