'use client';

import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import * as Popover from '@radix-ui/react-popover';
import { ArrowDown, Check, ChevronsUpDown } from 'lucide-react';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { useEffect, useRef } from 'react';
import { voteFilters } from './MenuBar';
import Image from 'next/image';

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
      className={`mt-4 min-w-4xl self-center overflow-visible px-2 text-neutral-800
        transition-opacity duration-300 dark:text-neutral-200
        ${view === ViewEnum.FULL ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='flex w-full items-center justify-between gap-2 border border-neutral-800
          bg-white p-2 text-sm font-bold shadow-lg transition-colors'
      >
        <div className='flex w-full justify-between'>
          {expanded ? (
            <div
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <Image
                src='/assets/web/arrow-up.svg'
                alt={''}
                width={24}
                height={24}
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
              <Image
                src='/assets/web/arrow-down.svg'
                alt={''}
                width={24}
                height={24}
              />
              <div>Read Proposal</div>
            </div>
          )}

          <div className='flex'>
            <div className='flex h-8 cursor-pointer items-center justify-start gap-2 px-3 text-sm'>
              <div className='relative flex items-start'>
                <input
                  type='checkbox'
                  id='comments'
                  checked={comments}
                  onChange={(e) => setComments(e.target.checked)}
                  className='h-6 w-6 cursor-pointer appearance-none'
                />
                {comments ? (
                  <Image
                    className='absolute'
                    src='/assets/web/checkbox_check.svg'
                    alt={''}
                    width={24}
                    height={24}
                  />
                ) : (
                  <Image
                    className='absolute'
                    src='/assets/web/checkbox_nocheck.svg'
                    alt={''}
                    width={24}
                    height={24}
                  />
                )}
              </div>
              <label
                htmlFor='comments'
                className='flex cursor-pointer items-center gap-2'
              >
                All comments
              </label>
            </div>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className='flex h-8 w-44 items-center justify-between px-3 text-sm'
                  aria-expanded={false}
                >
                  {voteFilters.find((filter) => filter.value === votesFilter)
                    ?.label || 'Select vote filter...'}
                  <Image
                    src='/assets/web/chevron_down.svg'
                    alt={''}
                    width={24}
                    height={24}
                  />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className='w-[200px] border border-neutral-800 bg-neutral-50 p-1 shadow-lg
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
                        setVotesFilter(filter.value as VotesFilterEnum);
                      }}
                    >
                      {filter.label}
                      {votesFilter === filter.value && (
                        <Image
                          src='/assets/web/check.svg'
                          alt={''}
                          width={24}
                          height={24}
                        />
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
