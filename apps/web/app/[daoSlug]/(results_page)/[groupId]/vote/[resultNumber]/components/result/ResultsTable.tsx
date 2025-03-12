'use client';
import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { DelegateInfo, DelegateVotingPower } from '../actions';
import { ProcessedResults } from '@/lib/results_processing';
import * as Select from '@radix-ui/react-select';
import CheckSvg from '@/public/assets/web/check.svg';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import Image from 'next/image';
import { VotingPowerTag } from './VotingPowerTag';

interface ResultsTableProps {
  results: ProcessedResults;
  delegateMap: Map<string, DelegateInfo>;
  votingPowerMap: Map<string, DelegateVotingPower>;
}

const SelectItem = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; value: string }
>(({ children, value, ...props }, forwardedRef) => {
  return (
    <Select.Item
      className='relative flex h-[35px] cursor-pointer items-center pr-10 pl-2 text-sm
        text-neutral-800 transition-colors outline-none hover:bg-neutral-100
        dark:text-neutral-200 dark:hover:bg-neutral-700'
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

export function ResultsTable({
  results,
  delegateMap,
  votingPowerMap,
}: ResultsTableProps) {
  const [sortColumn, setSortColumn] = useState<'timestamp' | 'votingPower'>(
    'votingPower'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedChoice, setSelectedChoice] = useState<string>('all');

  const sortedAndFilteredVotes = useMemo(() => {
    let filteredVotes = results.votes || [];

    // Apply choice filter
    if (selectedChoice !== 'all') {
      filteredVotes = filteredVotes.filter((vote) =>
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
    const barWidth = `${(vote.relativeVotingPower || 0) * 100}%`;
    const votingPowerInfo = votingPowerMap.get(vote.voterAddress);

    return (
      <div key={key} style={style} className='relative'>
        {/* Color bar */}
        <div
          className='absolute top-0 left-0 h-2 opacity-50'
          style={{ width: barWidth }}
        >
          {Array.isArray(vote.color) ? (
            <div className='flex h-full w-full'>
              {vote.color.map((color, index) => (
                <div
                  key={index}
                  className='h-full'
                  style={{
                    width: `${(1 / vote.color.length) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              className='h-full w-full'
              style={{ backgroundColor: vote.color }}
            />
          )}
        </div>

        {/* Existing content */}
        <div className='relative grid h-20 grid-cols-7 items-center p-2'>
          <div className='col-span-2 flex items-center gap-2 overflow-hidden pb-2 font-bold'>
            {delegate ? (
              <div className='flex w-full min-w-0 items-center gap-2'>
                <div
                  className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full
                    border-2 border-neutral-700 dark:border-neutral-300'
                >
                  <Image
                    src={
                      delegate.profilePictureUrl ||
                      `https://api.dicebear.com/9.x/pixel-art/png?seed=${delegate.ens}`
                    }
                    className='rounded-full'
                    fetchPriority='high'
                    alt={delegate.ens ?? delegate.address}
                    width={40}
                    height={40}
                  />
                </div>
                <div className='flex min-w-0 flex-col gap-1'>
                  <span className='truncate'>
                    {delegate.ens ?? delegate.address}
                  </span>
                  {votingPowerInfo && (
                    <VotingPowerTag votingPower={votingPowerInfo} />
                  )}
                </div>
              </div>
            ) : (
              <div className='w-full truncate'>
                <span className='font-mono'>{vote.voterAddress}</span>
              </div>
            )}
          </div>
          <div className='col-span-3 flex cursor-default flex-col truncate px-2'>
            <div className='font-bold'>
              <div className='truncate' title={choiceText}>
                {choiceText}
              </div>
            </div>
            {vote.reason && (
              <div className='text-neutral-450 text-sm'>
                {isUrl(vote.reason) ? (
                  <Link
                    className='block truncate underline'
                    href={vote.reason}
                    target='_blank'
                    rel='noopener noreferrer'
                    title={vote.reason} // Shows full URL on hover
                  >
                    {vote.reason}
                  </Link>
                ) : (
                  <div className='truncate' title={vote.reason}>
                    {/* Shows full reason on hover */}
                    {vote.reason}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className='col-span-1 cursor-default px-2'>
            <div className='font-bold'>
              {formatDistanceToNow(vote.createdAt!, { addSuffix: true })}
            </div>
            <div className='text-sm'>
              {format(toZonedTime(vote.createdAt!, 'UTC'), 'MMM d, yyyy')} UTC
            </div>
          </div>
          <div className='col-span-1 flex cursor-default flex-col items-end px-2'>
            <div className='font-mono font-bold'>
              {formatNumberWithSuffix(vote.votingPower)} ARB
            </div>
            <div className='font-mono text-sm'>
              {votingPowerPercentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TableHeader = () => (
    <div
      className='sticky top-[88px] z-10 mb-2 grid grid-cols-7 items-center justify-between gap-2
        rounded-xs border border-neutral-800 bg-neutral-200 p-2 text-sm font-bold
        text-neutral-800 transition-colors dark:border-neutral-600 dark:bg-neutral-800
        dark:text-neutral-200'
    >
      <div className='col-span-2 flex items-center gap-1 text-left'>
        Delegate
      </div>
      <div className='col-span-3'>
        <Select.Root value={selectedChoice} onValueChange={setSelectedChoice}>
          <Select.Trigger
            className='flex h-8 w-full cursor-pointer items-center justify-between rounded-sm text-sm
              text-neutral-800 transition-colors outline-none dark:text-neutral-200'
          >
            <Select.Value
              placeholder='Filter by choice'
              className='flex w-full items-center justify-between'
            >
              <div className='flex items-center gap-1'>
                {selectedChoice === 'all' ? 'All Choices' : selectedChoice}
                <ChevronDownSvg
                  width={24}
                  height={24}
                  className='text-neutral-800 dark:text-neutral-200'
                />
              </div>
            </Select.Value>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content
              className='w-full rounded-sm border border-neutral-200 bg-white p-1 shadow-lg
                dark:border-neutral-700 dark:bg-neutral-800'
              position='popper'
              sideOffset={5}
            >
              <Select.Viewport className=''>
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
        className='col-span-1 flex cursor-pointer items-center gap-1'
      >
        Date
        <span className='transform'>
          {sortColumn === 'timestamp' ? (
            <ArrowSvg
              width={24}
              height={24}
              className={`transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
            />
          ) : (
            <ArrowSvg
              width={24}
              height={24}
              className={'rotate-180 fill-neutral-400 transition-transform'}
            />
          )}
        </span>
      </div>
      <div
        onClick={() => handleSortChange('votingPower')}
        className='col-span-1 flex cursor-pointer items-center justify-end gap-1 text-right'
      >
        Voting Power
        <span className='transform'>
          {sortColumn === 'votingPower' ? (
            <ArrowSvg
              width={24}
              height={24}
              className={`transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
            />
          ) : (
            <ArrowSvg
              width={24}
              height={24}
              className={'rotate-180 fill-neutral-400 transition-transform'}
            />
          )}
        </span>
      </div>
    </div>
  );

  return (
    <div className='mt-6'>
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
                rowHeight={80}
                rowRenderer={rowRenderer}
              />
            )}
          </AutoSizer>
        )}
      </WindowScroller>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className='mt-6'>
      {/* Header */}
      <div
        className='sticky top-[88px] z-10 mb-2 grid grid-cols-7 items-center gap-2 border-b
          border-neutral-800 bg-neutral-200 p-2 dark:border-neutral-700
          dark:bg-neutral-800'
      >
        <div className='col-span-2 flex items-center'>
          <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        <div className='col-span-3'>
          <div className='h-8 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        <div className='col-span-1 flex items-center justify-end gap-2'>
          <div className='h-4 w-16 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        <div className='col-span-1 flex items-center justify-end gap-2'>
          <div className='h-4 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
      </div>

      {/* Rows */}
      {[...Array(10)].map((_, index) => (
        <div key={index} className='relative'>
          {/* Color bar */}
          <div
            className='absolute top-0 left-0 h-2 w-full opacity-50'
            style={{ width: '10%' }} // Adjust the width as needed to match the real content
          >
            <div className='h-full w-full animate-pulse bg-neutral-300 dark:bg-neutral-700' />
          </div>

          {/* Row content */}
          <div className='relative grid h-20 grid-cols-7 items-center p-2'>
            <div className='col-span-2 flex items-center gap-2'>
              <div className='h-10 w-10 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700' />
              <div className='flex flex-col gap-1'>
                <div className='h-4 w-32 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
                <div className='h-3 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              </div>
            </div>
            <div className='col-span-3 flex flex-col gap-1 px-2'>
              <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
            <div className='col-span-1 flex flex-col gap-1 px-2'>
              <div className='h-4 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-20 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
            <div className='col-span-1 flex flex-col items-end gap-1 px-2'>
              <div className='h-4 w-28 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-16 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
