import React from 'react';

export interface VoteSegmentProps {
  color: string;
  width: number;
  isAggregated?: boolean;
  useTw?: boolean; // For API routes using tw syntax
}

export const VoteSegment = ({
  color,
  width,
  isAggregated = false,
  useTw = false,
}: VoteSegmentProps) => {
  const baseStyle = {
    width: `${width}%`,
    ...(isAggregated
      ? {
          background: `repeating-linear-gradient(
                  90deg,
                  ${color} 0px,
                  ${color} 1px,
                  transparent 1px,
                  transparent 2px
                )`,
        }
      : { backgroundColor: color, marginRight: 1 }),
  };

  return useTw ? (
    <div tw={'h-full'} style={baseStyle} />
  ) : (
    <div className={'h-full'} style={baseStyle} />
  );
};
