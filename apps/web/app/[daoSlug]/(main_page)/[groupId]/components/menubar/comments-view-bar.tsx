'use client';

import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { feedFilters, ViewEnum, fromFilters } from './menu-bar';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

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
      className={`fixed top-0 mt-24 w-full max-w-4xl self-center px-4 pb-4 sm:px-2 ${
        view === ViewEnum.COMMENTS ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className='dark:border-neutral-450 flex w-full flex-col items-stretch justify-between gap-3 rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm font-bold text-neutral-800 sm:flex-row sm:items-center dark:bg-neutral-950 dark:fill-neutral-200 dark:text-neutral-200'>
        <div className='flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center'>
          {/* Read Full Proposal Button */}
          <div className='hidden sm:flex sm:justify-start'>
            <button
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setView(ViewEnum.BODY);
                setExpanded(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label='Read full proposal'
            >
              <ArrowSvg width={24} height={24} />
              <div className='text-sm'>Read Full Proposal</div>
            </button>
          </div>

          {/* Filters */}
          <div className='flex flex-row gap-2 self-center sm:items-center sm:space-x-2'>
            {includesProposals ? (
              <Select
                value={feedFilter}
                onValueChange={(value) =>
                  setFeedFilter(value as FeedFilterEnum)
                }
              >
                <SelectTrigger
                  aria-label='Select feed filter'
                  className='w-full text-sm sm:w-48'
                >
                  <SelectValue>{currentFeedFilter}</SelectValue>
                </SelectTrigger>

                <SelectContent>
                  {feedFilters.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className='flex h-8 items-center justify-center rounded-xs px-3 text-sm'>
                Comments
              </div>
            )}

            <Select
              value={fromFilter}
              onValueChange={(value) => setFromFilter(value as FromFilterEnum)}
            >
              <SelectTrigger
                aria-label='Select votes filter'
                className='w-full text-sm sm:w-44'
              >
                <SelectValue>{currentFromFilter}</SelectValue>
              </SelectTrigger>

              <SelectContent>
                {fromFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
