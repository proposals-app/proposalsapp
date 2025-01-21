'use client';

import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import * as Popover from '@radix-ui/react-popover';
import * as Switch from '@radix-ui/react-switch';
import { ArrowDown, ArrowUp, Check, ChevronsUpDown } from 'lucide-react';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { useEffect, useRef } from 'react';
import { voteFilters } from './MenuBar';

const useDebouncedScroll = (callback: () => void, delay: number) => {
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      timeoutId.current = setTimeout(callback, delay);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [callback, delay]);
};

export const FullViewBar = () => {
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

  const [expanded, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false).withOptions({ shallow: false })
  );

  const fullViewBarRef = useRef<HTMLDivElement | null>(null);

  useDebouncedScroll(() => {
    if (!fullViewBarRef.current) return;

    const rect = fullViewBarRef.current.getBoundingClientRect();

    if (rect.top < 80 && view !== ViewEnum.COMMENTS) {
      setView(ViewEnum.COMMENTS);
    } else if (
      rect.top >= 80 &&
      rect.bottom <= window.innerHeight &&
      view !== ViewEnum.FULL
    ) {
      setView(ViewEnum.FULL);
    } else if (rect.top > window.innerHeight && view !== ViewEnum.BODY) {
      setView(ViewEnum.BODY);
    }
  }, 10);

  return (
    <div
      ref={fullViewBarRef}
      className={`mt-4 w-full self-center px-2 transition-opacity duration-300 ${
        view === ViewEnum.FULL ? 'opacity-100' : 'opacity-0' }`}
    >
      <div
        className='flex w-full items-center justify-between gap-2 rounded-full border
          border-neutral-350 bg-white p-2 text-sm font-bold shadow-lg transition-colors
          dark:border-neutral-800 dark:bg-neutral-950'
      >
        <div className='flex w-full justify-between text-neutral-600 dark:text-neutral-200'>
          {expanded ? (
            <div
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowDown
                className='h-8 w-8 rounded-full border border-neutral-350 bg-neutral-50 p-1
                  hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                  dark:hover:bg-neutral-700'
              />
              <div>Collapse Proposal</div>
            </div>
          ) : (
            <div
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setView(ViewEnum.BODY);
                setExpanded(true);
              }}
            >
              <ArrowDown
                className='h-8 w-8 rounded-full border border-neutral-350 bg-neutral-50 p-1
                  hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                  dark:hover:bg-neutral-700'
              />
              <div>Read Full Proposal</div>
            </div>
          )}

          <div className='flex gap-2'>
            <div
              className='flex h-8 cursor-pointer items-center justify-start rounded-full border
                border-neutral-350 bg-neutral-50 px-4 pl-1 pr-4 text-sm transition-colors
                hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                dark:hover:bg-neutral-700'
            >
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
                    className='h-6 w-6 cursor-pointer appearance-none rounded-full border border-neutral-350
                      bg-neutral-50 checked:border-neutral-400 dark:border-neutral-700
                      dark:bg-neutral-800'
                  />
                  {comments && (
                    <svg
                      width='12'
                      height='9'
                      viewBox='0 0 12 9'
                      fill='none'
                      xmlns='http://www.w3.org/2000/svg'
                      className='pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        fill-neutral-700 dark:fill-neutral-200'
                    >
                      <path d='M0.680398 4.75L1.54403 3.86364L4.54403 6.81818L10.7486 0.636363L11.6349 1.52273L4.54403 8.59091L0.680398 4.75Z' />
                    </svg>
                  )}
                </div>
                Show comments
              </label>
            </div>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className='flex h-8 w-[200px] items-center justify-between rounded-full border
                    border-neutral-350 bg-neutral-50 px-4 text-sm transition-colors
                    hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                    dark:hover:bg-neutral-700'
                  aria-expanded={false}
                >
                  {voteFilters.find((filter) => filter.value === votesFilter)
                    ?.label || 'Select vote filter...'}
                  <ChevronsUpDown className='h-4 w-4 opacity-50' />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className='w-[200px] rounded-md border border-neutral-350 bg-neutral-50 p-1 shadow-lg
                  dark:border-neutral-700 dark:bg-neutral-800'
                sideOffset={5}
              >
                <div className='space-y-1'>
                  {voteFilters.map((filter) => (
                    <button
                      key={filter.value}
                      className='flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm
                        transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700'
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
  );
};
