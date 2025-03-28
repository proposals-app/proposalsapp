'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { VotesWithVoters } from '../actions';
import {
  ProcessedResults,
  ProcessedVote,
  VoteType,
} from '@/lib/results_processing';
import ArrowSvg from '@/public/assets/web/icons/arrow-up.svg';
import superjson, { SuperJSONResult } from 'superjson';
import { VoterAuthor } from '@/app/[daoSlug]/components/author-voter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

interface ResultsTableProps {
  results: SuperJSONResult;
  votes: SuperJSONResult;
}

// Helper to get choice text from the new choice structure
const getChoiceText = (vote: ProcessedVote, voteType: VoteType): string => {
  if (!vote.choice || vote.choice.length === 0) return 'Unknown Choice';

  if (voteType == 'weighted') {
    // For weighted voting, include the weight percentage
    return vote.choice
      .map((choice) => `${Math.round(choice.weight)}% for ${choice.text}`)
      .join(', ');
  } else {
    // For other voting types, just show the choice text
    return vote.choice.map((choice) => choice.text).join(', ');
  }
};

// Helper to check if a vote includes a specific choice text
const voteIncludesChoiceText = (
  vote: ProcessedVote,
  choiceText: string
): boolean => {
  if (!vote.choice || vote.choice.length === 0) return false;

  return vote.choice.some((choice) => choice.text.includes(choiceText));
};

export function ResultsTable({ results, votes }: ResultsTableProps) {
  const deserializedResults: ProcessedResults = superjson.deserialize(results);
  const deserializedVotes: VotesWithVoters = superjson.deserialize(votes);

  const [sortColumn, setSortColumn] = useState<'timestamp' | 'votingPower'>(
    'votingPower'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedChoice, setSelectedChoice] = useState<string | number>('all');

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Use a common breakpoint like 768px for sm
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sortedAndFilteredVotes = useMemo(() => {
    let filteredVotes = deserializedResults.votes || [];

    // Apply choice filter
    if (selectedChoice !== 'all') {
      filteredVotes = filteredVotes.filter((vote) =>
        voteIncludesChoiceText(vote, selectedChoice.toString())
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
  }, [deserializedResults.votes, sortColumn, sortDirection, selectedChoice]);

  const handleSortChange = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedChoice, sortColumn, sortDirection]);

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
    const voteWithVoter = deserializedVotes.find(
      (voteWithViter) => voteWithViter.voterAddress == vote.voterAddress
    );
    const votingPowerPercentage =
      (vote.votingPower / deserializedResults.totalVotingPower) * 100;
    const shouldHideVote =
      deserializedResults.hiddenVote &&
      deserializedResults.scoresState !== 'final';
    const choiceText = shouldHideVote
      ? 'Hidden vote'
      : getChoiceText(vote, deserializedResults.voteType);
    const barWidth = `${(vote.relativeVotingPower || 0) * 100}%`;

    // Define row height based on isMobile state
    const rowHeight = isMobile ? 140 : 80; // Use fixed height for mobile

    return (
      <div
        key={key}
        style={{ ...style, height: `${rowHeight}px` }} // Apply fixed height
        className='relative border-b border-neutral-200 dark:border-neutral-700'
      >
        {/* Color bar */}
        <div
          className='absolute top-0 left-0 h-2 opacity-50'
          style={{ width: barWidth }}
        >
          {vote.choice.length > 0 && (
            <div className='flex h-full w-full flex-wrap'>
              {vote.choice.map((choiceItem, idx) => {
                const itemWidth = vote.choice.every((c) => c.weight === 100)
                  ? '100%'
                  : `${choiceItem.weight}%`;

                return (
                  <div
                    key={idx}
                    className='h-full'
                    style={{
                      width: itemWidth,
                      backgroundColor: choiceItem.color,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Row content - Conditional Rendering */}
        {isMobile ? (
          // === Mobile Layout ===
          <div className='flex h-full flex-col justify-between p-3'>
            {/* Top section: Delegate */}
            <div>
              {voteWithVoter ? (
                <VoterAuthor
                  voterAddress={voteWithVoter.voterAddress}
                  ens={voteWithVoter.ens}
                  avatar={voteWithVoter.avatar}
                  discourseUsername={voteWithVoter.discourseUsername}
                  // Show event VP on mobile for relevance to the vote
                  eventVotingPower={voteWithVoter.votingPower}
                  // Optionally hide current VP on mobile if too cluttered
                  currentVotingPower={voteWithVoter.latestVotingPower}
                />
              ) : (
                <div className='w-full truncate font-mono font-bold'>
                  <span>{vote.voterAddress}</span>
                </div>
              )}
            </div>

            {/* Middle section: Choice & Reason */}
            <div className='mt-1'>
              <div className='font-bold' title={choiceText}>
                {/* Allow choice text to wrap on mobile, remove truncate */}
                {choiceText}
              </div>
              {vote.reason && (
                <div className='text-neutral-450 mt-0.5 hidden text-sm sm:block'>
                  {isUrl(vote.reason) ? (
                    <Link
                      className='block break-all underline' // Allow URL to break
                      href={vote.reason}
                      target='_blank'
                      rel='noopener noreferrer'
                      title={vote.reason}
                    >
                      {vote.reason}
                    </Link>
                  ) : (
                    <div className='line-clamp-1' title={vote.reason}>
                      {' '}
                      {/* Limit reason lines */}
                      {vote.reason}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom section: VP and Date */}
            <div className='mt-1 flex items-end justify-between text-sm'>
              {/* Voting Power (Left) */}
              <div className=''>
                <div className='font-mono font-bold'>
                  {formatNumberWithSuffix(vote.votingPower)} ARB
                </div>
                <div className='font-mono text-xs'>
                  {' '}
                  {/* Smaller font for % */}
                  {votingPowerPercentage.toFixed(1)}%
                </div>
              </div>
              {/* Date (Right) */}
              <div className='text-right'>
                <div className='font-bold'>
                  {formatDistanceToNow(vote.createdAt!, { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // === Desktop Layout ===
          <div className='relative grid h-full grid-cols-7 items-center gap-4 px-2 pt-2'>
            {/* Column 1: Delegate */}
            <div className='col-span-2'>
              {voteWithVoter ? (
                <VoterAuthor
                  voterAddress={voteWithVoter.voterAddress}
                  ens={voteWithVoter.ens}
                  discourseUsername={voteWithVoter.discourseUsername}
                  avatar={voteWithVoter.avatar}
                  currentVotingPower={voteWithVoter.latestVotingPower}
                  eventVotingPower={voteWithVoter.votingPower}
                />
              ) : (
                <div className='w-full truncate font-mono font-bold'>
                  <span>{vote.voterAddress}</span>
                </div>
              )}
            </div>

            {/* Column 2: Voting Power */}
            <div className='col-span-1 px-2 text-right'>
              <div className='font-mono font-bold'>
                {formatNumberWithSuffix(vote.votingPower)} ARB
              </div>
              <div className='font-mono text-sm'>
                {votingPowerPercentage.toFixed(1)}%
              </div>
            </div>

            {/* Column 3: Vote Choice and Reason */}
            <div className='col-span-3 px-2'>
              <div className='font-bold'>
                <div className='truncate' title={choiceText}>
                  {choiceText}
                </div>
              </div>
              {vote.reason && (
                <div className='text-neutral-450 mt-1 text-sm'>
                  {isUrl(vote.reason) ? (
                    <Link
                      className='block truncate underline'
                      href={vote.reason}
                      target='_blank'
                      rel='noopener noreferrer'
                      title={vote.reason}
                    >
                      {vote.reason}
                    </Link>
                  ) : (
                    <div className='truncate' title={vote.reason}>
                      {vote.reason}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column 4: Date */}
            <div className='col-span-1 px-2 text-right text-sm'>
              <div className='font-bold'>
                {formatDistanceToNow(vote.createdAt!, { addSuffix: true })}
              </div>
              <div className=''>
                {' '}
                {/* Removed hidden, always show */}
                {format(toZonedTime(vote.createdAt!, 'UTC'), 'MMM d, yyyy')} UTC
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = () => (
    // Desktop header remains the same structure
    <div className='sticky top-[88px] z-10 mb-2 hidden border border-neutral-800 bg-neutral-200 p-2 text-sm font-bold text-neutral-800 sm:grid sm:grid-cols-7 sm:items-center sm:justify-between sm:gap-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'>
      {/* Col 1: Delegate */}
      <div className='col-span-2 flex items-center gap-1 text-left'>
        Delegate
      </div>
      {/* Col 2: Voting Power */}
      <div
        onClick={() => handleSortChange('votingPower')}
        className='col-span-1 flex cursor-pointer items-center justify-end gap-1'
      >
        Voting Power
        <span className='transform'>
          {sortColumn === 'votingPower' ? (
            <ArrowSvg
              width={24}
              height={24}
              className={`transition-transform ${
                sortDirection === 'desc' ? 'rotate-180' : ''
              }`}
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
      {/* Col 3: Choice Filter */}
      <div className='col-span-3'>
        <Select value={selectedChoice} onValueChange={setSelectedChoice}>
          <SelectTrigger aria-label='Filter by choice'>
            <SelectValue>
              {selectedChoice === 'all' ? 'All Vote Choices' : selectedChoice}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            <SelectItem value='all'>All Choices</SelectItem>
            {deserializedResults.choices.map((choice, index) => (
              <SelectItem key={index} value={choice}>
                {choice}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Col 4: Date */}
      <div
        onClick={() => handleSortChange('timestamp')}
        className='col-span-1 flex cursor-pointer items-center justify-end gap-1 text-right'
      >
        Date
        <span className='transform'>
          {sortColumn === 'timestamp' ? (
            <ArrowSvg
              width={24}
              height={24}
              className={`transition-transform ${
                sortDirection === 'desc' ? 'rotate-180' : ''
              }`}
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

  // Mobile Filter Header remains the same
  const MobileFilterHeader = () => (
    <div className='sticky top-[88px] z-10 mb-2 block border border-neutral-800 bg-neutral-200 p-2 font-bold sm:hidden dark:border-neutral-600 dark:bg-neutral-800'>
      <Select value={selectedChoice} onValueChange={setSelectedChoice}>
        <SelectTrigger aria-label='Filter by choice'>
          <SelectValue>
            {selectedChoice === 'all' ? 'All Vote Choices' : selectedChoice}
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          <SelectItem value='all'>All Choices</SelectItem>
          {deserializedResults.choices.map((choice, index) => (
            <SelectItem key={index} value={choice}>
              {choice}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <TableHeader />
      <MobileFilterHeader />
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
                // Use fixed height based on isMobile
                rowHeight={isMobile ? 140 : 80}
                rowRenderer={rowRenderer}
                overscanRowCount={5} // Keep overscan for smoother scroll
              />
            )}
          </AutoSizer>
        )}
      </WindowScroller>
    </div>
  );
}

export function LoadingTable() {
  const mobileRowHeight = 140;
  const desktopRowHeight = 80;
  // Loading state updated for both desktop and mobile structures
  return (
    <div>
      {/* Desktop Header */}
      <div className='sticky top-[88px] z-10 mb-2 hidden h-12 grid-cols-7 items-center gap-2 border border-neutral-800 bg-neutral-200 p-2 sm:grid dark:border-neutral-600 dark:bg-neutral-800'>
        {/* Delegate */}
        <div className='col-span-2 flex items-center'>
          <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        {/* Voting Power */}
        <div className='col-span-1 flex items-center justify-end gap-2'>
          <div className='h-4 w-16 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        {/* Choice */}
        <div className='col-span-3'>
          <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        {/* Date */}
        <div className='col-span-1 flex items-center justify-end gap-2'>
          <div className='h-4 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
      </div>
      {/* Mobile Header (Filter Only) */}
      <div className='sticky top-[88px] z-10 mb-2 block h-12 border border-neutral-800 bg-neutral-200 p-2 sm:hidden dark:border-neutral-600 dark:bg-neutral-800'>
        <div className='h-full w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
      </div>

      {/* Rows */}
      {[...Array(10)].map((_, index) => (
        <div
          key={index}
          className='relative border-b border-neutral-200 dark:border-neutral-700'
          // Set height explicitly on the container for loading state consistency
          style={{ height: `${desktopRowHeight}px` }}
        >
          {/* Color bar Skeleton */}
          <div className='absolute top-0 left-0 h-2 w-[10%] animate-pulse bg-neutral-300 opacity-50 dark:bg-neutral-700' />

          {/* === Desktop Loading Row Structure === */}
          <div className='relative hidden h-full grid-cols-7 items-center p-2 sm:grid'>
            {/* Delegate */}
            <div className='col-span-2 flex items-center gap-2'>
              <div className='h-10 w-10 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700' />
              <div className='flex flex-col gap-1'>
                <div className='h-4 w-32 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
                <div className='h-3 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              </div>
            </div>
            {/* Voting Power */}
            <div className='col-span-1 flex flex-col items-end gap-1 px-2'>
              <div className='h-4 w-20 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-12 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
            {/* Choice */}
            <div className='col-span-3 flex flex-col gap-1 px-2'>
              <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
            {/* Date */}
            <div className='col-span-1 flex flex-col items-end gap-1 px-2'>
              <div className='h-4 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-20 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
          </div>
          {/* === Mobile Loading Row Structure === */}
          {/* Need to override the height inherited from the parent for mobile */}
          <div
            className='relative flex h-full flex-col justify-between p-3 sm:hidden'
            style={{ height: `${mobileRowHeight}px` }}
          >
            {/* Delegate Skeleton */}
            <div className='flex items-center gap-2'>
              <div className='h-10 w-10 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-4 w-32 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
            {/* Choice Skeleton */}
            <div className='flex flex-col gap-1'>
              <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              <div className='h-3 w-4/5 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
            {/* VP (Left) & Date (Right) Skeleton */}
            <div className='flex items-end justify-between'>
              {/* VP Skeleton */}
              <div className='flex flex-col items-start gap-1'>
                <div className='h-4 w-20 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
                <div className='h-3 w-12 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
              </div>
              {/* Date Skeleton */}
              <div className='h-4 w-24 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
