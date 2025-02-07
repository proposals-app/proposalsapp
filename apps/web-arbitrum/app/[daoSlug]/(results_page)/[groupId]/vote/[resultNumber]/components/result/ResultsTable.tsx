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
import CheckSvg from '@/public/assets/web/check.svg';

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
      className='relative flex h-[35px] cursor-pointer items-center pr-10 pl-2 text-sm
        transition-colors outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
      {...props}
      ref={forwardedRef}
      value={value}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className='absolute right-2'>
        <CheckSvg width={24} height={24} />
      </Select.ItemIndicator>
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
              <span className='truncate'>
                {delegate.ens ?? delegate.address}
              </span>
            </>
          )}
          {!delegate && <span className='truncate'>{vote.voterAddress}</span>}
        </div>
        <div className='flex cursor-default flex-col truncate px-2'>
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

  const TableHeader = () => (
    <div
      className='dark:border-neutral-450 sticky top-[88px] z-10 grid grid-cols-4 items-center
        justify-between gap-2 border-b border-neutral-800 bg-white p-2 text-sm font-bold
        text-neutral-800 transition-colors dark:bg-neutral-950 dark:text-neutral-200'
    >
      <div className='flex items-center gap-1'>Delegate</div>
      <Select.Root value={selectedChoice} onValueChange={setSelectedChoice}>
        <Select.Trigger
          className='flex h-8 w-full cursor-pointer items-center justify-between px-3 text-sm
            outline-none'
        >
          <Select.Value placeholder='Filter by choice'>
            {selectedChoice === 'all' ? 'All Choices' : selectedChoice} ▼
          </Select.Value>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className='dark:border-neutral-450 w-full border border-neutral-800 bg-white p-1 shadow-lg
              dark:bg-neutral-950'
            position='popper'
            sideOffset={5}
          >
            <Select.Viewport>
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
  );

  return (
    <div className='mt-6'>
      <div className='rounded-md border border-neutral-300'>
        <TableHeader />
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
