'use client';

import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  feedFilters,
  SharedSelectItem,
  ViewEnum,
  fromFilters,
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
} from './menu-bar';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import React from 'react';

interface CommentsViewBarProps {
  view: ViewEnum;
  setView: (view: ViewEnum) => void;
  includesProposals: boolean;
}

export const CommentsViewBar = ({
  view,
  setView,
  includesProposals,
}: CommentsViewBarProps) => {
  const [feedFilter, setFeedFilter] = useQueryState(
    'feed',
    parseAsStringEnum<FeedFilterEnum>(Object.values(FeedFilterEnum))
      .withDefault(FeedFilterEnum.COMMENTS_AND_VOTES)
      .withOptions({ shallow: false })
  );

  const [fromFilter, setFromFilter] = useQueryState(
    'from',
    parseAsStringEnum<FromFilterEnum>(Object.values(FromFilterEnum))
      .withDefault(FromFilterEnum.ALL)
      .withOptions({ shallow: false })
  );

  const [, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  // Find the current filter labels
  const currentFeedFilter =
    feedFilters.find((filter) => filter.value === feedFilter)?.label || '';
  const currentFromFilter =
    fromFilters.find((filter) => filter.value === fromFilter)?.label || '';

  return (
    <div
      className={`fixed top-0 mt-24 w-full self-center px-4 pb-4 md:max-w-4xl md:px-2
        ${view === ViewEnum.COMMENTS ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='dark:border-neutral-450 flex w-full flex-col items-stretch justify-between gap-2
          rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
          font-bold text-neutral-800 md:flex-row md:items-center dark:bg-neutral-950
          dark:fill-neutral-200 dark:text-neutral-200'
      >
        <div className='flex w-full justify-between'>
          <button
            className='flex cursor-pointer items-center gap-2 hover:underline md:gap-4'
            onClick={() => {
              setView(ViewEnum.BODY);
              setExpanded(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label='Read full proposal'
          >
            <ArrowSvg width={24} height={24} />
            <div className='text-xs md:text-sm'>Read Full Proposal</div>
          </button>

          <div
            className='flex flex-col items-stretch space-y-1 md:flex-row md:items-center md:space-y-0
              md:space-x-2'
          >
            {includesProposals ? (
              <Select
                value={feedFilter}
                onValueChange={(value) =>
                  setFeedFilter(value as FeedFilterEnum)
                }
              >
                <SelectTrigger
                  aria-label='Select feed filter'
                  className='w-full text-xs md:w-48 md:text-sm'
                >
                  <SelectValue>{currentFeedFilter}</SelectValue>
                </SelectTrigger>

                <SelectContent>
                  {feedFilters.map((filter) => (
                    <SharedSelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SharedSelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className='flex h-8 items-center justify-center rounded-xs px-3 text-xs md:text-sm'>
                Comments
              </div>
            )}

            <Select
              value={fromFilter}
              onValueChange={(value) => setFromFilter(value as FromFilterEnum)}
            >
              <SelectTrigger
                aria-label='Select votes filter'
                className='w-full text-xs md:w-48 md:text-sm'
              >
                <SelectValue>{currentFromFilter}</SelectValue>
              </SelectTrigger>

              <SelectContent>
                {fromFilters.map((filter) => (
                  <SharedSelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SharedSelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
