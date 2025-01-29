'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { DelegateInfo } from '../actions';
import { ProcessedResults } from '@/lib/votes_processing';

interface ResultsTableProps {
  results: ProcessedResults;
  delegateMap: Map<string, DelegateInfo>;
}

export function ResultsTable({ results, delegateMap }: ResultsTableProps) {
  const [sortColumn, setSortColumn] = useState<
    'choice' | 'timestamp' | 'votingPower'
  >('votingPower');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedVotes = useMemo(() => {
    const votesArray = results.votes || [];
    return [...votesArray].sort((a, b) => {
      let comparison = 0;

      // Default sorting for other vote types
      switch (sortColumn) {
        case 'choice':
          comparison = a.choiceText.localeCompare(b.choiceText);
          break;
        case 'timestamp':
          comparison = a.createdAt!.getTime() - b.createdAt!.getTime();
          break;
        case 'votingPower':
          comparison = a.votingPower - b.votingPower;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [results.votes, sortColumn, sortDirection]);

  const handleSortChange = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const vote = sortedVotes[index];
    const delegate = delegateMap.get(vote.voterAddress);

    const votingPowerPercentage =
      (vote.votingPower / results.totalVotingPower) * 100;

    const shouldHideVote =
      results.hiddenVote && results.scoresState !== 'final';
    const choiceText = shouldHideVote ? 'Hidden vote' : vote.choiceText;

    return (
      <div
        style={style}
        className='grid grid-cols-4 items-center border-b border-neutral-200 p-2
          dark:border-neutral-800'
      >
        <div className='flex items-center gap-2 px-2 font-bold'>
          {delegate && (
            <>
              <span className='truncate'>{delegate.name}</span>
            </>
          )}
          {!delegate && <span className='truncate'>{vote.voterAddress}</span>}
        </div>
        <div
          className='flex cursor-default flex-col truncate px-2'
          title={choiceText}
        >
          <div className='font-bold'>
            {choiceText.length > 20
              ? `${choiceText.substring(0, 20)}...`
              : choiceText}
          </div>
          {vote.reason && (
            <div className='text-sm'>
              {isUrl(vote.reason) ? (
                <Link
                  className='underline'
                  href={vote.reason}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {vote.reason.length > 30
                    ? `${vote.reason.substring(0, 30)}...`
                    : vote.reason}
                </Link>
              ) : (
                <div>
                  {vote.reason.length > 30
                    ? `${vote.reason.substring(0, 30)}...`
                    : vote.reason}
                </div>
              )}
            </div>
          )}
        </div>
        <div className='cursor-default px-2'>
          <div>{formatDistanceToNow(vote.createdAt!, { addSuffix: true })}</div>
          <div className='text-sm'>
            {format(toZonedTime(vote.createdAt!, 'UTC'), 'MMM d, yyyy')} UTC
          </div>
        </div>
        <div className='cursor-default px-2'>
          <div>{formatNumberWithSuffix(vote.votingPower)} ARB</div>
          <div className='text-sm'>{votingPowerPercentage.toFixed(1)}%</div>
        </div>
      </div>
    );
  };

  return (
    <div className='mt-6'>
      <div className='rounded-md border border-neutral-300 dark:border-neutral-700'>
        {/* Header */}
        <div className='grid grid-cols-4 border-b border-neutral-300 p-3 dark:border-neutral-700'>
          <div>Delegate</div>
          <div
            onClick={() => handleSortChange('choice')}
            className='flex cursor-default items-center gap-1'
          >
            Choice
            {sortColumn === 'choice' && (
              <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
          <div
            onClick={() => handleSortChange('timestamp')}
            className='flex cursor-default items-center gap-1'
          >
            Date
            {sortColumn === 'timestamp' && (
              <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
          <div
            onClick={() => handleSortChange('votingPower')}
            className='flex cursor-default items-center gap-1'
          >
            Voting Power
            {sortColumn === 'votingPower' && (
              <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
        </div>

        <List
          height={600}
          itemCount={sortedVotes.length}
          itemSize={60}
          width='100%'
        >
          {Row}
        </List>
      </div>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div
      className='mt-6 w-full rounded-lg border border-neutral-300 bg-white p-4
        dark:border-neutral-700 dark:bg-neutral-950'
    >
      {/* Header */}
      <div className='grid grid-cols-4 border-b border-neutral-300 p-3 dark:border-neutral-700'>
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-800' />
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-800' />
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-800' />
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-800' />
      </div>

      {/* Rows */}
      <div className='mt-4 space-y-2'>
        {[...Array(10)].map((_, index) => (
          <div
            key={index}
            className='grid h-12 grid-cols-4 items-center gap-4 rounded-lg bg-neutral-200 p-2
              dark:bg-neutral-800'
          >
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
          </div>
        ))}
      </div>
    </div>
  );
}
