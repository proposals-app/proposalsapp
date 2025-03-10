'use client';

import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { useEffect, useRef } from 'react';
import {
  feedFilters,
  SharedSelectItem,
  ViewEnum,
  voteFilters,
} from './MenuBar';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import * as Select from '@radix-ui/react-select';

interface FullViewBarProps {
  view: ViewEnum;
  setView: (view: ViewEnum) => void;
}

export const FullViewBar = ({ view, setView }: FullViewBarProps) => {
  const [feedFilter, setFeedFilter] = useQueryState(
    'feed',
    parseAsStringEnum<FeedFilterEnum>(Object.values(FeedFilterEnum))
      .withDefault(FeedFilterEnum.COMMENTS_AND_VOTES)
      .withOptions({ shallow: false })
  );

  const [votesFilter, setVotesFilter] = useQueryState(
    'votes',
    parseAsStringEnum<VotesFilterEnum>(Object.values(VotesFilterEnum))
      .withDefault(VotesFilterEnum.FIVE_MILLION)
      .withOptions({ shallow: false })
  );

  const [expanded, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false).withOptions({ shallow: false })
  );

  const fullViewBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
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
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [view, setView]);

  return (
    <div
      ref={fullViewBarRef}
      className={`mt-4 min-w-4xl self-center overflow-visible px-2
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
            <Select.Root
              value={feedFilter}
              onValueChange={(value) => setFeedFilter(value as FeedFilterEnum)}
            >
              <Select.Trigger
                className='flex h-8 w-44 cursor-pointer items-center justify-between px-3 text-sm
                  outline-none'
              >
                <Select.Value>
                  {
                    feedFilters.find((filter) => filter.value === feedFilter)
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
                  {feedFilters.map((filter) => (
                    <SharedSelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SharedSelectItem>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Root>

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
