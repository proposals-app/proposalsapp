'use client';

import { useState } from 'react';
import { formatNumberWithSuffix } from '@/lib/utils';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import { VoterAuthor } from '@/app/[daoSlug]/components/author-voter';
import { List, AutoSizer, WindowScroller } from 'react-virtualized';
import type { NonVotersData } from '../actions';

interface NonVotersTableProps {
  nonVoters: NonVotersData;
}

export function NonVotersTable({ nonVoters }: NonVotersTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  if (nonVoters.length === 0) return null;

  const sortedNonVoters = [...nonVoters].sort((a, b) => {
    const comparison = b.votingPowerAtStart - a.votingPowerAtStart;
    return sortDirection === 'asc' ? -comparison : comparison;
  });

  const rowRenderer = ({
    key,
    index,
    style,
  }: {
    key: string;
    index: number;
    style: React.CSSProperties;
  }) => {
    const voter = sortedNonVoters[index];

    return (
      <div
        key={key}
        style={style}
        className='grid grid-cols-12 items-center p-4'
      >
        <div className='col-span-8'>
          <VoterAuthor
            voterAddress={voter.voterAddress}
            ens={voter.ens}
            avatar={voter.avatar}
            currentVotingPower={voter.currentVotingPower}
            eventVotingPower={null}
          />
        </div>
        <div className='col-span-4 flex flex-col items-end font-mono'>
          <div className='font-bold'>
            {formatNumberWithSuffix(voter.votingPowerAtStart)} ARB
          </div>
        </div>
      </div>
    );
  };

  const TableHeader = () => (
    <div className='sticky top-[137px] z-[1999] mb-2 grid grid-cols-12 items-center justify-between gap-2 border border-neutral-800 bg-neutral-200 p-2 py-3 text-sm font-bold text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'>
      <div className='col-span-4'>Delegate</div>
      <div className='col-span-8'>
        <button
          onClick={() =>
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
          }
          className='flex w-full items-center justify-end gap-1'
        >
          Voting Power
          <ArrowSvg
            width={24}
            height={24}
            className={`transform transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <div className='mt-6'>
      <div className='sticky top-[88px] z-[1999] border-t border-r border-l border-neutral-800 bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className='flex w-full items-center justify-between bg-neutral-50 p-3 text-left dark:bg-neutral-900'
        >
          <div className='flex items-center gap-2'>
            <span className='text-sm font-bold'>
              {nonVoters.length} Non-Voters -{' '}
              {formatNumberWithSuffix(
                nonVoters.reduce(
                  (sum, voter) => sum + voter.votingPowerAtStart,
                  0
                )
              )}{' '}
              ARB
            </span>
          </div>
          <ChevronDownSvg
            width={24}
            height={24}
            className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div>
          <TableHeader />
          <WindowScroller>
            {({ height, isScrolling, onChildScroll, scrollTop }) => (
              <AutoSizer disableHeight>
                {({ width }) => (
                  <List
                    autoHeight
                    height={height}
                    width={width}
                    isScrolling={isScrolling}
                    onScroll={onChildScroll}
                    scrollTop={scrollTop}
                    rowCount={sortedNonVoters.length}
                    rowHeight={72}
                    rowRenderer={rowRenderer}
                    overscanRowCount={5}
                  />
                )}
              </AutoSizer>
            )}
          </WindowScroller>
        </div>
      )}
    </div>
  );
}

export function LoadingNonVotersTable() {
  return (
    <div className='mb-6 rounded-xs border border-neutral-200 dark:border-neutral-700'>
      <div className='p-4'>
        <div className='flex items-center justify-between'>
          <div className='h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-6 w-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
    </div>
  );
}
