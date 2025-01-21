'use client';

import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import * as Popover from '@radix-ui/react-popover';
import * as Switch from '@radix-ui/react-switch';
import { ArrowUp, Check, ChevronsUpDown } from 'lucide-react';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { voteFilters } from './MenuBar';

export const CommentsViewBar = () => {
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

  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum))
      .withDefault(ViewEnum.FULL)
      .withOptions({ shallow: false })
  );

  const [, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  return (
    <div
      className={`fixed top-0 z-50 flex w-full max-w-[90%] justify-center self-center px-4 pt-24
        transition-transform duration-300 md:max-w-[75%] lg:max-w-[48%] ${
        view === ViewEnum.COMMENTS ? 'translate-y-0' : '-translate-y-full' }`}
    >
      <div
        className='flex w-full items-center justify-between gap-2 rounded-full border
          border-neutral-350 bg-white p-2 text-sm font-bold shadow-lg transition-colors
          dark:border-neutral-800 dark:bg-neutral-950'
      >
        <div className='flex w-full justify-between text-neutral-600 dark:text-neutral-200'>
          <div
            className='flex cursor-pointer flex-row items-center gap-4 hover:underline'
            onClick={() => {
              setView(ViewEnum.BODY);
              setExpanded(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <ArrowUp className='h-8 w-8 rounded-full border p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800' />
            <div>Read Full Proposal</div>
          </div>
          <div className='flex gap-2'>
            <div className='flex items-center gap-2'>
              <Switch.Root
                id='comments'
                checked={comments}
                onCheckedChange={(checked) => setComments(checked)}
                className='relative h-6 w-11 rounded-full bg-neutral-200 px-0.5
                  data-[state=checked]:bg-brand-accent dark:bg-neutral-700
                  dark:data-[state=checked]:bg-brand-accent'
              >
                <Switch.Thumb
                  className='block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-100
                    will-change-transform data-[state=checked]:translate-x-5 dark:bg-neutral-950'
                />
              </Switch.Root>
              <label htmlFor='comments' className='cursor-pointer'>
                Show comments
              </label>
            </div>

            <div className='flex items-center gap-2'>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    className='flex h-8 w-[200px] items-center justify-between rounded-full border bg-white
                      px-4 text-sm dark:border-neutral-800 dark:bg-neutral-950'
                    aria-expanded={false}
                  >
                    {voteFilters.find((filter) => filter.value === votesFilter)
                      ?.label || 'Select vote filter...'}
                    <ChevronsUpDown className='h-4 w-4 opacity-50' />
                  </button>
                </Popover.Trigger>
                <Popover.Content
                  className='w-[200px] rounded-md border border-neutral-350 bg-white p-1 shadow-lg
                    dark:border-neutral-800 dark:bg-neutral-950'
                >
                  <div className='space-y-1'>
                    {voteFilters.map((filter) => (
                      <button
                        key={filter.value}
                        className='flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm
                          hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        onClick={() => {
                          setVotesFilter(
                            filter.value === votesFilter
                              ? VotesFilterEnum.ALL
                              : (filter.value as VotesFilterEnum)
                          );
                        }}
                      >
                        {filter.label}
                        {votesFilter === filter.value && (
                          <Check className='h-4 w-4' />
                        )}
                      </button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Root>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
