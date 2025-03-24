'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import React, { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { VotesWithVoters } from '../actions';
import {
  ProcessedResults,
  ProcessedVote,
  VoteType,
} from '@/lib/results_processing';
import CheckSvg from '@/public/assets/web/check.svg';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import superjson, { SuperJSONResult } from 'superjson';
import { VoterAuthor } from '@/app/[daoSlug]/components/author-voter';

interface ResultsTableProps {
  results: SuperJSONResult;
  votes: SuperJSONResult;
}

// Custom Select Context
const SelectContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedValue: string;
  onSelectValue: (value: string) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
  selectedValue: '',
  onSelectValue: () => {},
});

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider
      value={{
        isOpen,
        setIsOpen,
        selectedValue: value,
        onSelectValue: onValueChange,
      }}
    >
      <div className='relative'>{children}</div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = ({
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) => {
  const { isOpen, setIsOpen } = useContext(SelectContext);

  return (
    <button
      type='button'
      aria-haspopup='listbox'
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={`flex h-8 cursor-pointer items-center justify-between text-sm outline-none ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}
    </button>
  );
};

const SelectValue = ({ children }: { children: React.ReactNode }) => {
  return <span>{children}</span>;
};

const SelectContent = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { isOpen, setIsOpen } = useContext(SelectContext);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      className={`absolute z-[999] mt-1 overflow-hidden rounded-sm border border-neutral-200 bg-white p-1 shadow-lg will-change-transform dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
      role='listbox'
    >
      <div className='p-1'>{children}</div>
    </div>
  );
};

interface SelectItemProps {
  children: React.ReactNode;
  value: string;
}

const SelectItem = ({ children, value }: SelectItemProps) => {
  const { selectedValue, onSelectValue, setIsOpen } = useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      role='option'
      aria-selected={isSelected}
      className='relative flex h-[35px] cursor-pointer items-center pr-10 pl-2 text-sm text-neutral-800 will-change-transform outline-none hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700'
      onClick={() => {
        onSelectValue(value);
        setIsOpen(false);
      }}
    >
      <span>{children}</span>
      {isSelected && (
        <span className='absolute right-2'>
          <CheckSvg
            className='fill-neutral-800 dark:fill-neutral-200'
            width={24}
            height={24}
          />
        </span>
      )}
    </div>
  );
};

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
  const [selectedChoice, setSelectedChoice] = useState<string>('all');

  const sortedAndFilteredVotes = useMemo(() => {
    let filteredVotes = deserializedResults.votes || [];

    // Apply choice filter
    if (selectedChoice !== 'all') {
      filteredVotes = filteredVotes.filter((vote) =>
        voteIncludesChoiceText(vote, selectedChoice)
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

    // Get choice text using helper function
    const choiceText = shouldHideVote
      ? 'Hidden vote'
      : getChoiceText(vote, deserializedResults.voteType);
    const barWidth = `${(vote.relativeVotingPower || 0) * 100}%`;

    return (
      <div key={key} style={style} className='relative'>
        {/* Color bar */}
        <div
          className='absolute top-0 left-0 h-2 opacity-50'
          style={{ width: barWidth }}
        >
          {vote.choice.length > 0 && (
            <div className='flex h-full w-full flex-wrap'>
              {vote.choice.map((choiceItem, idx) => {
                // Calculate width based on weight - if all choices have 100% weight (like in approval voting),
                // they will wrap to new lines. If weights sum to 100%, they'll be in a single line.
                const itemWidth = vote.choice.every((c) => c.weight === 100)
                  ? '100%' // Each item takes full width and wraps
                  : `${choiceItem.weight}%`; // Proportional width based on weight

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

        {/* Existing content */}
        <div className='relative grid h-20 grid-cols-7 items-center p-2'>
          <div className='col-span-2 flex items-center gap-2 overflow-hidden pb-2'>
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
    <div className='sticky top-[88px] z-10 mb-2 grid grid-cols-7 items-center justify-between gap-2 border border-neutral-800 bg-neutral-200 p-2 text-sm font-bold text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'>
      <div className='col-span-2 flex items-center gap-1 text-left'>
        Delegate
      </div>
      <div className='col-span-3'>
        <Select value={selectedChoice} onValueChange={setSelectedChoice}>
          <SelectTrigger
            aria-label='Filter by choice'
            className='flex w-full items-center justify-between'
          >
            <SelectValue>
              <div className='flex items-center gap-1'>
                {selectedChoice === 'all' ? 'All Vote Choices' : selectedChoice}
                <ChevronDownSvg
                  width={24}
                  height={24}
                  className='text-neutral-800 dark:text-neutral-200'
                />
              </div>
            </SelectValue>
          </SelectTrigger>

          <SelectContent className='w-full'>
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
    <div>
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
