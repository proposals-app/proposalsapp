import React from 'react';
import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';
import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistance } from 'date-fns';

interface ApprovalVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
  currentTime: Date;
}

export const ApprovalVoteStatic = ({
  result,
  currentTime,
}: ApprovalVoteProps) => {
  const isHidden = result.hiddenVote && result.scoresState !== 'final';

  const finalResults = isHidden ? {} : result.finalResults || {};
  const totalVotingPower = isHidden ? 0 : result.totalVotingPower || 0;
  const choiceColors = result.choiceColors || [];
  const choices = result.choices || [];
  const voteSegments = result.voteSegments || {};

  // Calculate real time status
  const now = currentTime;
  const endAt = new Date(result.proposal.endAt);
  const isLive = now < endAt;
  const timeDiff = Math.abs(endAt.getTime() - now.getTime());
  const hoursUntilEnd = Math.floor(timeDiff / (1000 * 60 * 60));
  const isWithin24Hours = hoursUntilEnd < 24;

  // Determine text and color
  const timeText = isLive
    ? `ends ${formatDistance(endAt, currentTime, { addSuffix: true })}`
    : `ended ${formatDistance(endAt, currentTime, { addSuffix: true })}`;

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

  const getChoiceText = (choiceIndex: string) => {
    const index = parseInt(choiceIndex);
    return choices[index] || 'Unknown';
  };

  return (
    <div tw='bg-[rgba(239,239,239,0.25)] w-full border border-[#e9e9e9] flex'>
      <div
        tw='flex items-center w-full justify-between'
        style={{ padding: '8px 12px' }}
      >
        {/* Left section - Status indicator and text */}
        <div tw='flex items-center' style={{ gap: '8px' }}>
          {/* Green status indicator - only for active proposals */}
          {isLive && (
            <div tw='relative flex' style={{ width: '24px', height: '24px' }}>
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
          <div tw='flex flex-col' style={{ gap: '2px', width: '140px' }}>
            <div
              tw='text-[16px] font-bold text-[#374249] leading-4 flex'
              style={{ fontFamily: 'Fira Sans Condensed' }}
            >
              {statusText}
            </div>
            <div
              tw='text-[16px] font-normal leading-4 flex'
              style={{ fontFamily: 'Fira Sans Condensed', color: timeColor }}
            >
              {timeText}
            </div>
          </div>
        </div>

        {/* Center section - Vote results */}
        <div tw='flex flex-col' style={{ gap: '4px', width: '340px' }}>
          {/* Progress bar */}
          <div
            tw='flex w-full bg-[#EEE] overflow-hidden'
            style={{ height: '12px' }}
          >
            {Object.entries(voteSegments).map(([choiceKey, segments]) => {
              const choiceTotal = segments.reduce(
                (sum, seg) => sum + (seg.votingPower || 0),
                0
              );
              const widthPercentage =
                totalVotingPower > 0 && choiceTotal >= 0
                  ? (choiceTotal / totalVotingPower) * 100
                  : 0;
              if (widthPercentage === 0 || isNaN(widthPercentage)) return null;
              return (
                <div
                  key={choiceKey}
                  tw='h-full flex'
                  style={{
                    width: `${widthPercentage}%`,
                    backgroundColor:
                      choiceColors[parseInt(choiceKey)] || '#CBD5E1',
                  }}
                />
              );
            })}
          </div>

          {/* Vote counts - For approval votes, show top choices */}
          <div tw='flex justify-between w-full' style={{ marginTop: '2px' }}>
            <div
              tw='flex items-center text-[#374249] text-[16px]'
              style={{ gap: '8px' }}
            >
              <div
                tw='font-bold flex'
                style={{ fontFamily: 'Fira Sans Condensed' }}
              >
                {sortedChoices[0]
                  ? getChoiceText(sortedChoices[0][0])
                  : 'Choice 1'}
              </div>
              <div
                tw='font-normal flex'
                style={{ fontFamily: 'Fira Sans Condensed' }}
              >
                {sortedChoices[0]
                  ? formatNumberWithSuffix(Number(sortedChoices[0][1]))
                  : '0'}
              </div>
            </div>
            <div
              tw='flex items-center text-[#374249] text-[16px]'
              style={{ gap: '8px' }}
            >
              <div
                tw='font-normal flex'
                style={{ fontFamily: 'Fira Sans Condensed' }}
              >
                {sortedChoices[1]
                  ? formatNumberWithSuffix(Number(sortedChoices[1][1]))
                  : '0'}
              </div>
              <div
                tw='font-bold flex'
                style={{ fontFamily: 'Fira Sans Condensed' }}
              >
                {sortedChoices[1]
                  ? getChoiceText(sortedChoices[1][0])
                  : 'Choice 2'}
              </div>
            </div>
          </div>
        </div>

        {/* Right section - Vote button */}
        <div tw='bg-[#12aaff] flex'>
          <div
            tw='flex items-center justify-center'
            style={{ gap: '6px', padding: '8px 12px' }}
          >
            <div
              tw='text-[16px] font-bold text-white flex'
              style={{ fontFamily: 'Fira Sans Condensed', lineHeight: '16px' }}
            >
              Vote {onchain ? 'onchain' : 'offchain'}
            </div>
            {/* External link icon */}
            <div tw='flex' style={{ width: '16px', height: '16px' }}>
              <svg width='16' height='16' viewBox='0 0 18 18' fill='none'>
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
