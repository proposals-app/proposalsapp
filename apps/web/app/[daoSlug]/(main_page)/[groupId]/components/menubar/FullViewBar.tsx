'use client';

import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { useCallback, useEffect, useRef } from 'react';
import {
  feedFilters,
  SharedSelectItem,
  ViewEnum,
  voteFilters,
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
} from './MenuBar';
import ArrowSvg from '@/public/assets/web/arrow.svg';

interface FullViewBarProps {
  view: ViewEnum;
  setView: (view: ViewEnum) => void;
  includesProposals: boolean;
}

export const FullViewBar = ({
  view,
  setView,
  includesProposals,
}: FullViewBarProps) => {
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

  const [expanded, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  const fullViewBarRef = useRef<HTMLDivElement | null>(null);

  // Find the current filter labels
  const currentFeedFilter =
    feedFilters.find((filter) => filter.value === feedFilter)?.label || '';
  const currentVotesFilter =
    voteFilters.find((filter) => filter.value === votesFilter)?.label || '';

  const handleSwitchView = useCallback(() => {
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
  }, [view, setView]);

  useEffect(() => {
    window.addEventListener('scroll', handleSwitchView, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleSwitchView);
    };
  }, [handleSwitchView]);

  useEffect(() => {
    if (expanded) setView(ViewEnum.BODY);
    else setView(ViewEnum.FULL);
  }, [expanded, setView]);

  return (
    <div
      ref={fullViewBarRef}
      className={`mt-4 min-w-4xl self-center overflow-visible px-2
        ${view === ViewEnum.FULL ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='dark:border-neutral-450 flex w-full items-center justify-between gap-2
          rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
          font-bold text-neutral-800 dark:bg-neutral-950 dark:fill-neutral-200
          dark:text-neutral-200'
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
              aria-label='Collapse proposal'
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
              aria-label='Read proposal'
            >
              <ArrowSvg className='rotate-180' width={24} height={24} />
              <div>Read Proposal</div>
            </button>
          )}

          <div className='flex space-x-2'>
            {includesProposals ? (
              <Select
                value={feedFilter}
                onValueChange={(value) =>
                  setFeedFilter(value as FeedFilterEnum)
                }
              >
                <SelectTrigger aria-label='Select feed filter' className='w-48'>
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
              <div className='flex h-8 items-center justify-center rounded-xs px-3 text-sm'>
                Comments
              </div>
            )}

            <Select
              value={votesFilter}
              onValueChange={(value) =>
                setVotesFilter(value as VotesFilterEnum)
              }
            >
              <SelectTrigger aria-label='Select votes filter' className='w-44'>
                <SelectValue>{currentVotesFilter}</SelectValue>
              </SelectTrigger>

              <SelectContent>
                {voteFilters.map((filter) => (
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
