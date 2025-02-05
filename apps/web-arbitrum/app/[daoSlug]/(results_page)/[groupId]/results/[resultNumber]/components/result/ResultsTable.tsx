'use client';
import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { DelegateInfo } from '../actions';
import { ProcessedResults } from '@/lib/results_processing';
import * as Select from '@radix-ui/react-select';

interface ResultsTableProps {
  results: ProcessedResults;
  delegateMap: Map<string, DelegateInfo>;
}

const SelectItem = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; value: string }
>(({ children, value, ...props }, forwardedRef) => {
  return (
    <Select.Item
      className='relative flex h-[25px] cursor-pointer items-center pr-[35px] pl-[25px]
        outline-none focus:outline-none'
      {...props}
      ref={forwardedRef}
      value={value}
    >
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  );
});
SelectItem.displayName = 'SelectItem';

export function ResultsTable({ results, delegateMap }: ResultsTableProps) {
  const [sortColumn, setSortColumn] = useState<'timestamp' | 'votingPower'>(
    'votingPower'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedChoice, setSelectedChoice] = useState<string>('all');

  const sortedAndFilteredVotes = useMemo(() => {
    const votesArray = results.votes || [];
    let filteredVotes = votesArray;

    // Apply choice filter
    if (selectedChoice !== 'all') {
      filteredVotes = votesArray.filter((vote) =>
        vote.choiceText.includes(selectedChoice)
      );
    }

    // Apply sorting
    return [...filteredVotes].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'timestamp':
          comparison = a.createdAt!.getTime() - b.createdAt!.getTime();
          break;
        case 'votingPower':
          comparison = a.votingPower - b.votingPower;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [results.votes, sortColumn, sortDirection, selectedChoice]);

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

  const rowRenderer = ({
    index,
    key,
    style,
  }: {
    index: number;
    key: string;
    style: React.CSSProperties;
  }) => {
    const vote = sortedAndFilteredVotes[index];
    const delegate = delegateMap.get(vote.voterAddress);

    const votingPowerPercentage =
      (vote.votingPower / results.totalVotingPower) * 100;

    const shouldHideVote =
      results.hiddenVote && results.scoresState !== 'final';
    const choiceText = shouldHideVote ? 'Hidden vote' : vote.choiceText;

    return (
      <div
        key={key}
        style={style}
        className='grid grid-cols-4 items-center border-b border-neutral-200 p-2'
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
      <div className='rounded-md border border-neutral-300'>
        {/* Header */}
        <div className='grid grid-cols-4 border-b border-neutral-300 p-3'>
          <div>Delegate</div>
          <div className='flex items-center gap-2'>
            <Select.Root
              value={selectedChoice}
              onValueChange={setSelectedChoice}
            >
              <Select.Trigger
                className='inline-flex h-[35px] cursor-pointer items-center justify-center gap-[5px]
                  px-[15px] outline-none focus:outline-none'
                aria-label='Choice'
              >
                <Select.Value placeholder='Filter by choice'>
                  {selectedChoice === 'all' ? 'All Choices' : selectedChoice} ▼
                </Select.Value>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  className='overflow-hidden bg-white'
                  position='popper'
                  sideOffset={5}
                >
                  <Select.Viewport className='p-[5px]'>
                    <SelectItem value='all'>All Choices</SelectItem>
                    {results.choices.map((choice, index) => (
                      <SelectItem key={index} value={choice}>
                        {choice}
                      </SelectItem>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          <div
            onClick={() => handleSortChange('timestamp')}
            className='flex cursor-pointer items-center gap-1'
          >
            Date
            {sortColumn === 'timestamp' && (
              <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
          <div
            onClick={() => handleSortChange('votingPower')}
            className='flex cursor-pointer items-center gap-1'
          >
            Voting Power
            {sortColumn === 'votingPower' && (
              <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
        </div>

        <WindowScroller>
          {({ height, isScrolling, onChildScroll, scrollTop }) => (
            <AutoSizer disableHeight>
              {({ width }) => (
                <List
                  autoHeight
                  width={width}
                  height={height}
                  isScrolling={isScrolling}
                  onScroll={onChildScroll}
                  scrollTop={scrollTop}
                  rowCount={sortedAndFilteredVotes.length}
                  rowHeight={60}
                  rowRenderer={rowRenderer}
                />
              )}
            </AutoSizer>
          )}
        </WindowScroller>
      </div>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className='mt-6 w-full rounded-lg border border-neutral-300 bg-white p-4'>
      {/* Header */}
      <div className='grid grid-cols-4 border-b border-neutral-300 p-3'>
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200' />
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200' />
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200' />
        <div className='h-4 w-24 animate-pulse rounded-sm bg-neutral-200' />
      </div>

      {/* Rows */}
      <div className='mt-4 space-y-2'>
        {[...Array(10)].map((_, index) => (
          <div
            key={index}
            className='grid h-12 grid-cols-4 items-center gap-4 rounded-lg bg-neutral-200 p-2'
          >
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300' />
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300' />
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300' />
            <div className='h-4 w-full animate-pulse rounded-sm bg-neutral-300' />
          </div>
        ))}
      </div>
    </div>
  );
}
