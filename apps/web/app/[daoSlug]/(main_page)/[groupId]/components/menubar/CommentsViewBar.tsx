'use client';

import { VotesFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { SharedSelectItem, ViewEnum, voteFilters } from './MenuBar';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import CheckboxCheck from '@/public/assets/web/checkbox_check.svg';
import CheckboxNocheck from '@/public/assets/web/checkbox_nocheck.svg';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import * as Select from '@radix-ui/react-select';
import React from 'react';

interface CommentsViewBarProps {
  view: ViewEnum;
  setView: (view: ViewEnum) => void;
}

export const CommentsViewBar = ({ view, setView }: CommentsViewBarProps) => {
  const [comments, setComments] = useQueryState(
    'comments',
    parseAsBoolean.withDefault(true).withOptions({ shallow: false })
  );

  const [votesFilter, setVotesFilter] = useQueryState(
    'votes',
    parseAsStringEnum<VotesFilterEnum>(Object.values(VotesFilterEnum))
      .withDefault(VotesFilterEnum.FIVE_MILLION)
      .withOptions({ shallow: false })
  );

  const [, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  return (
    <div
      className={`fixed top-0 z-50 mt-24 min-w-4xl self-center px-4 pb-4
        ${view === ViewEnum.COMMENTS ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='dark:border-neutral-450 flex w-full items-center justify-between gap-2
          rounded-xs border border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
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

          <div className='flex gap-2'>
            <div className='flex h-8 cursor-pointer items-center justify-start gap-2 px-3 text-sm'>
              <label
                htmlFor='comments'
                className='flex cursor-pointer items-center gap-2'
              >
                <div className='relative flex items-start'>
                  <input
                    type='checkbox'
                    id='comments'
                    checked={comments}
                    onChange={(e) => setComments(e.target.checked)}
                    className='h-6 w-6 cursor-pointer appearance-none'
                  />
                  {comments ? (
                    <CheckboxCheck
                      className='absolute inset-0'
                      width={24}
                      height={24}
                    />
                  ) : (
                    <CheckboxNocheck
                      className='absolute inset-0'
                      width={24}
                      height={24}
                    />
                  )}
                </div>
                Show comments
              </label>
            </div>

            <Select.Root
              value={votesFilter}
              onValueChange={(value) =>
                setVotesFilter(value as VotesFilterEnum)
              }
            >
              <Select.Trigger
                className='flex h-8 w-[200px] cursor-pointer items-center justify-between px-3 text-sm
                  outline-none'
              >
                <Select.Value>
                  {
                    voteFilters.find((filter) => filter.value === votesFilter)
                      ?.label
                  }
                </Select.Value>
                <Select.Icon>
                  <ChevronDownSvg width={24} height={24} />
                </Select.Icon>
              </Select.Trigger>

              <Select.Content
                className='dark:border-neutral-450 w-[200px] border border-neutral-800 bg-white p-1
                  shadow-lg dark:bg-neutral-950'
                position='popper'
                sideOffset={5}
              >
                <Select.Viewport>
                  {voteFilters.map((filter) => (
                    <SharedSelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SharedSelectItem>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>
    </div>
  );
};
