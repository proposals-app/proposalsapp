'use client';

import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { useEffect, useRef } from 'react';
import { SharedSelectItem, voteFilters } from './MenuBar';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import CheckboxCheck from '@/public/assets/web/checkbox_check.svg';
import CheckboxNocheck from '@/public/assets/web/checkbox_nocheck.svg';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import * as Select from '@radix-ui/react-select';

const useIntersectionObserver = (
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {}
) => {
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(callback);
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '-80px 0px 0px 0px',
        ...options,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [callback, options]);

  return targetRef;
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

  const handleIntersection = (entry: IntersectionObserverEntry) => {
    const { intersectionRatio, boundingClientRect } = entry;

    // Element is mostly visible in the viewport
    if (intersectionRatio > 0.5) {
      setView(ViewEnum.FULL);
    }
    // Element is above the viewport
    else if (boundingClientRect.top < 0) {
      setView(ViewEnum.COMMENTS);
    }
    // Element is below the viewport
    else if (boundingClientRect.top > window.innerHeight) {
      setView(ViewEnum.BODY);
    }
  };

  const fullViewBarRef = useIntersectionObserver(handleIntersection);

  return (
    <div
      ref={fullViewBarRef}
      className={`mt-4 min-w-4xl self-center overflow-visible px-2 transition-opacity duration-300
        ${view === ViewEnum.FULL ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='dark:border-neutral-450 flex w-full items-center justify-between gap-2
          rounded-xs border border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
          font-bold text-neutral-800 transition-colors dark:bg-neutral-950
          dark:fill-neutral-200 dark:text-neutral-200'
      >
        <div className='flex w-full justify-between'>
          {expanded ? (
            <button
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowSvg width={24} height={24} />
              <div>Collapse Proposal</div>
            </button>
          ) : (
            <button
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setView(ViewEnum.BODY);
                setExpanded(true);
              }}
            >
              <ArrowSvg className='rotate-180' width={24} height={24} />
              <div>Read Proposal</div>
            </button>
          )}

          <div className='flex'>
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
                All comments
              </label>
            </div>

            <Select.Root
              value={votesFilter}
              onValueChange={(value) =>
                setVotesFilter(value as VotesFilterEnum)
              }
            >
              <Select.Trigger
                className='flex h-8 w-44 cursor-pointer items-center justify-between px-3 text-sm
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
