import React from 'react';
import type { ProcessedResults } from '@/lib/results_processing';
import type { VoteSegmentData } from '@/lib/types';

interface HiddenVoteProps {
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export const DiscourseHiddenVote = ({ result }: HiddenVoteProps) => {
  return (
    <div tw='bg-[rgba(239,239,239,0.25)] w-full border border-[#e9e9e9] flex'>
      <div tw='flex items-center w-full p-[10px] justify-center'>
        <div tw='flex items-center' style={{ gap: '8px' }}>
          <div
            tw='text-[16px] font-bold text-[#374249] flex'
            style={{ fontFamily: 'Fira Sans Condensed' }}
          >
            Hidden
          </div>
          {result.scoresState === 'final' && (
            <div
              tw='text-[14px] text-[#374249] flex'
              style={{ fontFamily: 'Fira Sans Condensed' }}
            >
              (Results available)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
