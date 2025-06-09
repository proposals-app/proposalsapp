import React from 'react';
import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';
import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface BasicVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  debugBar?: boolean;
}

// Static version for ImageResponse - no hooks allowed
export const BasicVoteStatic = ({
  result,
  debugBar = false,
}: BasicVoteProps) => {
  const isHidden = result.hiddenVote && result.scoresState !== 'final';

  const finalResults = isHidden ? {} : result.finalResults || {};
  const choiceColors = result.choiceColors || [];
  const choices = result.choices || [];
  const voteSegments = result.voteSegments || {};

  // Calculate real time status
  const now = new Date();
  const endAt = new Date(result.proposal.endAt);
  const isLive = now < endAt;
  const timeDiff = Math.abs(endAt.getTime() - now.getTime());
  const hoursUntilEnd = Math.floor(timeDiff / (1000 * 60 * 60));
  const isWithin24Hours = hoursUntilEnd < 24;

  // Determine text and color
  const timeText = isLive
    ? `ends ${formatDistanceToNow(endAt, { addSuffix: true })}`
    : `ended ${formatDistanceToNow(endAt, { addSuffix: true })}`;

  const timeColor = isLive && isWithin24Hours ? '#cc3d35' : '#374249';
  const onchain = result.proposal.blockCreatedAt ? true : false;
  const statusText = isLive
    ? `Active ${onchain ? 'Onchain' : 'Offchain'} vote`
    : `Ended ${onchain ? 'Onchain' : 'Offchain'} vote`;

  if (isHidden) {
    return (
      <div tw='flex w-full bg-gray-100 border border-gray-200 rounded-lg p-3'>
        <div tw='flex items-center'>
          <div tw='text-sm text-gray-600'>Hidden</div>
        </div>
      </div>
    );
  }

  // Sort choices by voting power
  const sortedChoices = Object.entries(finalResults).sort(
    ([, aVotes], [, bVotes]) => Number(bVotes) - Number(aVotes)
  );

  return (
    <div
      tw='bg-[rgba(239,239,239,0.25)] w-full h-full border border-[#e9e9e9] flex'
      style={{ maxWidth: '100%' }}
    >
      <div
        tw='flex items-center w-full justify-between h-full'
        style={{ padding: '10px', minWidth: '0' }}
      >
        {/* Left section - Status indicator and text */}
        <div tw='flex items-start' style={{ gap: '12px', flex: '0 0 auto' }}>
          {/* Green status indicator - only for active proposals */}
          {isLive && (
            <div
              tw='relative flex'
              style={{ width: '32px', height: '32px', flexShrink: '0' }}
            >
              <svg width='32' height='32' viewBox='0 0 32 32'>
                {/* Outer pulsing ring */}
                <circle
                  cx='16'
                  cy='16'
                  r='12'
                  fill='rgba(47,255,0,0.5)'
                  opacity='0.7'
                >
                  <animate
                    attributeName='r'
                    values='8;12;8'
                    dur='2s'
                    repeatCount='indefinite'
                  />
                  <animate
                    attributeName='opacity'
                    values='0.7;0.5;0.7'
                    dur='2s'
                    repeatCount='indefinite'
                  />
                </circle>
                {/* Inner solid dot */}
                <circle cx='16' cy='16' r='4' fill='#2FFF00' />
              </svg>
            </div>
          )}

          {/* Status text */}
          <div
            tw='flex flex-col justify-between'
            style={{ flex: '0 0 auto', height: '40px' }}
          >
            <div
              tw='text-[16px] font-bold text-[#374249] flex'
              style={{ fontFamily: 'Fira Sans Condensed', lineHeight: '16px' }}
            >
              {statusText}
            </div>
            <div
              tw='text-[16px] font-normal flex'
              style={{
                fontFamily: 'Fira Sans Condensed',
                lineHeight: '16px',
                color: timeColor,
              }}
            >
              {timeText}
            </div>
          </div>
        </div>

        {/* Center section - Vote results */}
        <div
          tw='flex flex-col justify-between'
          style={{
            flex: '1 1 auto',
            marginLeft: '20px',
            marginRight: '20px',
            height: '40px',
          }}
        >
          {/* Progress bar with individual segments */}
          <div
            tw='relative flex w-full overflow-hidden'
            style={{
              height: '16px',
              backgroundColor: debugBar ? '#FF0000' : '#EEE',
            }}
          >
            {(() => {
              // Sort segments by choice order: For, Abstain, Against
              const forIndex = choices.indexOf('For');
              const abstainIndex = choices.indexOf('Abstain');
              const againstIndex = choices.indexOf('Against');
              const choiceOrder = [forIndex, abstainIndex, againstIndex].filter(
                (index) => index !== -1
              );

              const allSegments = choiceOrder
                .flatMap((choiceIndex) => {
                  const choiceKey = choiceIndex.toString();
                  const segments = voteSegments[choiceKey] || [];
                  return segments
                    .map((segment, segmentIndex) => {
                      if (!segment.votingPower || segment.votingPower <= 0)
                        return null;

                      const color =
                        choiceColors[parseInt(choiceKey)] || '#CBD5E1';
                      const isLastSegment =
                        choiceIndex === choiceOrder[choiceOrder.length - 1] &&
                        segmentIndex === segments.length - 1;

                      if (segment.isAggregated) {
                        // Create many small lines for aggregated segments
                        const totalWidth = segment.votingPower; // Use voting power as flex basis
                        const lineCount = Math.max(
                          5,
                          Math.min(100, Math.floor(totalWidth / 5000))
                        ); // Between 5-100 lines
                        const lines = [];

                        for (let i = 0; i < lineCount; i++) {
                          lines.push(
                            <div
                              key={`line-${choiceKey}-${segmentIndex}-${i}`}
                              tw='h-full'
                              style={{
                                width: '1px',
                                backgroundColor: color,
                                marginRight: i < lineCount - 1 ? '1px' : '0',
                              }}
                            />
                          );
                        }

                        return (
                          <div
                            key={`segment-${choiceKey}-${segmentIndex}`}
                            tw='h-full flex'
                            style={{
                              flex: `${segment.votingPower} 0 0`,
                              backgroundColor: 'transparent',
                              borderRight: isLastSegment
                                ? 'none'
                                : '1px solid rgba(238,238,238,0.5)',
                              overflow: 'hidden',
                            }}
                          >
                            {lines}
                          </div>
                        );
                      } else {
                        // Regular solid segment
                        return (
                          <div
                            key={`segment-${choiceKey}-${segmentIndex}`}
                            tw='h-full'
                            style={{
                              flex: `${segment.votingPower} 0 0`,
                              backgroundColor: color,
                              borderRight: isLastSegment
                                ? 'none'
                                : '1px solid rgba(238,238,238,0.5)',
                            }}
                          />
                        );
                      }
                    })
                    .filter(Boolean);
                })
                .filter(Boolean);

              return allSegments;
            })()}
          </div>

          {/* Vote counts */}
          <div tw='flex justify-between w-full'>
            <div tw='flex items-center text-[#374249]' style={{ gap: '8px' }}>
              <div
                tw='text-[16px] font-bold flex'
                style={{
                  fontFamily: 'Fira Sans Condensed',
                  lineHeight: '16px',
                }}
              >
                For
              </div>
              <div
                tw='text-[16px] font-normal flex'
                style={{
                  fontFamily: 'Fira Sans Condensed',
                  lineHeight: '16px',
                }}
              >
                {sortedChoices[0]
                  ? formatNumberWithSuffix(Number(sortedChoices[0][1]))
                  : '0'}
              </div>
            </div>
            <div tw='flex items-center text-[#374249]' style={{ gap: '8px' }}>
              <div
                tw='text-[16px] font-normal flex'
                style={{
                  fontFamily: 'Fira Sans Condensed',
                  lineHeight: '16px',
                }}
              >
                {sortedChoices[1]
                  ? formatNumberWithSuffix(Number(sortedChoices[1][1]))
                  : '0'}
              </div>
              <div
                tw='text-[16px] font-bold flex'
                style={{
                  fontFamily: 'Fira Sans Condensed',
                  lineHeight: '16px',
                }}
              >
                Against
              </div>
            </div>
          </div>
        </div>

        {/* Right section - Vote button */}
        <div
          tw='bg-[#12aaff] flex'
          style={{ flex: '0 0 auto', height: '40px' }}
        >
          <div
            tw='flex items-center justify-center h-full'
            style={{ gap: '8px', padding: '0 14px' }}
          >
            <div
              tw='text-[16px] font-bold text-white flex'
              style={{ fontFamily: 'Fira Sans Condensed', lineHeight: '16px' }}
            >
              Vote {onchain ? 'onchain' : 'offchain'}
            </div>
            {/* External link icon */}
            <div tw='flex' style={{ width: '18px', height: '18px' }}>
              <svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
                <path
                  d='M5.70898 2H2V16H16V12.7051L18 10.7051V18H0V0H7.70898L5.70898 2ZM18 5.88086L16 7.88086V3.41797L6.00391 13.4141L4.58984 12L14.5898 2H10.5332L12.5332 0H18V5.88086Z'
                  fill='white'
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
