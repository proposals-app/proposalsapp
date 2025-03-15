'use client';

import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  feedFilters,
  SharedSelectItem,
  ViewEnum,
  voteFilters,
  SelectTrigger,
  SelectContent,
} from './MenuBar';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import * as Select from '@radix-ui/react-select';
import React from 'react';
import { unstable_ViewTransition as ViewTransition } from 'react';

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

  const [votesFilter, setVotesFilter] = useQueryState(
    'votes',
    parseAsStringEnum<VotesFilterEnum>(Object.values(VotesFilterEnum))
      .withDefault(VotesFilterEnum.FIFTY_THOUSAND)
      .withOptions({ shallow: false })
  );

  const [, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  // Find the current filter labels
  const currentFeedFilter =
    feedFilters.find((filter) => filter.value === feedFilter)?.label || '';
  const currentVotesFilter =
    voteFilters.find((filter) => filter.value === votesFilter)?.label || '';

  return (
    <ViewTransition name='menubar'>
      <div
        className={`fixed top-0 z-50 mt-24 min-w-4xl self-center px-4 pb-4
          ${view === ViewEnum.COMMENTS ? 'opacity-100' : 'opacity-0'}`}
      >
        <div
          className='dark:border-neutral-450 flex w-full items-center justify-between gap-2
            rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
            font-bold text-neutral-800 transition-colors dark:bg-neutral-950
            dark:fill-neutral-200 dark:text-neutral-200'
        >
          <div className='flex w-full justify-between'>
            <button
              className='flex cursor-pointer items-center gap-4'
              onClick={() => {
                setView(ViewEnum.BODY);
                setExpanded(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowSvg width={24} height={24} />
              <div>Read Full Proposal</div>
            </button>

            <div className='flex space-x-2'>
              {includesProposals ? (
                <Select.Root
                  value={feedFilter}
                  onValueChange={(value) =>
                    setFeedFilter(value as FeedFilterEnum)
                  }
                >
                  <SelectTrigger
                    aria-label='Select feed filter'
                    className='w-[200px]'
                  >
                    <Select.Value>{currentFeedFilter}</Select.Value>
                  </SelectTrigger>

                  <SelectContent>
                    {feedFilters.map((filter) => (
                      <SharedSelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SharedSelectItem>
                    ))}
                  </SelectContent>
                </Select.Root>
              ) : (
                <div className='flex h-8 items-center justify-center rounded-xs px-3 text-sm'>
                  Comments
                </div>
              )}

              <Select.Root
                value={votesFilter}
                onValueChange={(value) =>
                  setVotesFilter(value as VotesFilterEnum)
                }
              >
                <SelectTrigger
                  aria-label='Select votes filter'
                  className='w-[200px]'
                >
                  <Select.Value>{currentVotesFilter}</Select.Value>
                </SelectTrigger>

                <SelectContent>
                  {voteFilters.map((filter) => (
                    <SharedSelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SharedSelectItem>
                  ))}
                </SelectContent>
              </Select.Root>
            </div>
          </div>
        </div>
      </div>
    </ViewTransition>
  );
};
