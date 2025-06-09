import React from 'react';

export interface SegmentedQuorumBarProps {
  quorumContributingChoices: {
    choiceIndex: number;
    votingPower: number;
    color: string;
  }[];
  quorum: number;
  totalDelegatedVp: number;
  useTw?: boolean; // For API routes using tw syntax
}

export const SegmentedQuorumBar = ({
  quorumContributingChoices,
  quorum,
  totalDelegatedVp,
  useTw = false,
}: SegmentedQuorumBarProps) => {
  const quorumPercentage =
    totalDelegatedVp > 0 ? (quorum / totalDelegatedVp) * 100 : 0;

  const containerClasses = useTw
    ? 'relative flex h-2 w-full'
    : 'relative h-2 w-full';

  const lineClasses = useTw
    ? 'absolute -top-1 z-10 h-4 w-0.5 bg-neutral-900 dark:bg-neutral-50'
    : 'absolute -top-1 z-10 h-4 w-0.5 bg-neutral-900 dark:bg-neutral-50';

  const innerClasses = useTw
    ? 'absolute inset-0 flex overflow-hidden border border-neutral-800 dark:border-neutral-200'
    : 'absolute inset-0 flex overflow-hidden border border-neutral-800 dark:border-neutral-200';

  return useTw ? (
    <div tw={containerClasses}>
      {/* Quorum Line */}
      {quorumPercentage > 0 && quorumPercentage <= 100 && (
        <div
          tw={lineClasses}
          style={{
            left: `${quorumPercentage}%`,
            transform: quorumPercentage === 100 ? 'translateX(-100%)' : 'none',
          }}
        />
      )}
      {/* Choices that count towards quorum */}
      <div tw={innerClasses}>
        {quorumContributingChoices.map((choice, index) => {
          const choiceWidthPercentage =
            totalDelegatedVp > 0
              ? (choice.votingPower / totalDelegatedVp) * 100
              : 0;
          if (choiceWidthPercentage <= 0) return null;

          return (
            <div
              key={`quorum-segment-${choice.choiceIndex}-${index}`}
              tw='h-full'
              style={{
                width: `${choiceWidthPercentage}%`,
                backgroundColor: choice.color,
              }}
            />
          );
        })}
      </div>
    </div>
  ) : (
    <div className={containerClasses}>
      {/* Quorum Line */}
      {quorumPercentage > 0 && quorumPercentage <= 100 && (
        <div
          className={lineClasses}
          style={{
            left: `${quorumPercentage}%`,
            transform: quorumPercentage === 100 ? 'translateX(-100%)' : 'none',
          }}
        />
      )}
      {/* Choices that count towards quorum */}
      <div className={innerClasses}>
        {quorumContributingChoices.map((choice, index) => {
          const choiceWidthPercentage =
            totalDelegatedVp > 0
              ? (choice.votingPower / totalDelegatedVp) * 100
              : 0;
          if (choiceWidthPercentage <= 0) return null;

          return (
            <div
              key={`quorum-segment-${choice.choiceIndex}-${index}`}
              className='h-full'
              style={{
                width: `${choiceWidthPercentage}%`,
                backgroundColor: choice.color,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
