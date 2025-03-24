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
import ArrowSvg from '@/public/assets/web/arrow.svg';
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

    return (
      <div
        key={key}
        style={{ ...style, height: isMobile ? '160px' : '80px' }}
        className='relative'
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

        {/* Row content */}
        <div
          className={`relative flex h-full pt-3 sm:pt-0 ${isMobile ? 'flex-col justify-between gap-1' : 'grid grid-cols-7 items-center gap-4'} px-2`}
        >
          {/* Voter/Delegate */}
          <div className={isMobile ? '' : 'col-span-2'}>
            {voteWithVoter ? (
              <VoterAuthor
                voterAddress={voteWithVoter.voterAddress}
                ens={voteWithVoter.ens}
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

          {/* Vote Choice and Reason */}
          <div className={isMobile ? '' : 'col-span-3 px-2'}>
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

          {/* Bottom row for mobile: Date and Voting Power */}
          <div
            className={`flex ${isMobile ? 'items-center justify-between' : 'col-span-2 grid grid-cols-2'} text-sm`}
          >
            <div className={isMobile ? '' : 'px-2'}>
              <div className='font-bold'>
                {formatDistanceToNow(vote.createdAt!, { addSuffix: true })}
              </div>
              <div className='hidden sm:block'>
                {format(toZonedTime(vote.createdAt!, 'UTC'), 'MMM d, yyyy')} UTC
              </div>
            </div>

            <div className={`text-right ${isMobile ? '' : 'px-2'}`}>
              <div className='font-mono font-bold'>
                {formatNumberWithSuffix(vote.votingPower)} ARB
              </div>
              <div className='font-mono text-sm'>
                {votingPowerPercentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Divider for mobile */}
        {isMobile && (
          <div className='absolute right-0 bottom-0 left-0 border-b border-neutral-200 dark:border-neutral-700'></div>
        )}
      </div>
    );
  };

  const TableHeader = () => (
    <div className='sticky top-[88px] z-10 mb-2 hidden border border-neutral-800 bg-neutral-200 p-2 text-sm font-bold text-neutral-800 sm:grid sm:grid-cols-7 sm:items-center sm:justify-between sm:gap-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'>
      <div className='col-span-2 flex items-center gap-1 text-left'>
        Delegate
      </div>
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

  // Mobile Filter Header
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
                rowHeight={isMobile ? 160 : 80}
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
  // Loading state remains the same
  return (
    <div className='mt-6'>
      {/* Header */}
      <div className='sticky top-[88px] z-10 mb-2 grid h-12 grid-cols-7 items-center gap-2 border-b border-neutral-800 bg-neutral-200 p-2 dark:border-neutral-700 dark:bg-neutral-800'>
        <div className='col-span-2 flex items-center'>
          <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
        </div>
        <div className='col-span-3'>
          <div className='h-4 w-full animate-pulse rounded bg-neutral-300 dark:bg-neutral-700' />
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
