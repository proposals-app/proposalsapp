'use client';

import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { useCallback, useEffect, useRef } from 'react';
import { ViewEnum, feedFilters, fromFilters } from './menu-bar';
import ArrowSvg from '@/public/assets/web/icons/arrow-up.svg';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

interface FullViewBarProps {
  view: ViewEnum;
  setView: (view: ViewEnum) => void;
  includesProposals: boolean;
}

export const FullViewBar = ({
  view: _view,
  setView,
  includesProposals,
}: FullViewBarProps) => {
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

  const [expanded, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  const fullViewBarRef = useRef<HTMLDivElement | null>(null);

  // Find the current filter labels
  const currentFeedFilter =
    feedFilters.find((filter) => filter.value === feedFilter)?.label || '';
  const currentFromFilter =
    fromFilters.find((filter) => filter.value === fromFilter)?.label || '';

  const handleSwitchView = useCallback(() => {
    if (!fullViewBarRef.current) return;

    const rect = fullViewBarRef.current.getBoundingClientRect();

    if (rect.top < 80 && _view !== ViewEnum.COMMENTS) {
      setView(ViewEnum.COMMENTS);
    } else if (
      rect.top >= 80 &&
      rect.bottom <= window.innerHeight &&
      _view !== ViewEnum.FULL
    ) {
      setView(ViewEnum.FULL);
    } else if (rect.top > window.innerHeight && _view !== ViewEnum.BODY) {
      setView(ViewEnum.BODY);
    }
  }, [_view, setView]);

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
      className={`mt-4 w-full min-w-full self-center overflow-visible sm:min-w-4xl sm:px-2 ${
        _view === ViewEnum.FULL ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className='dark:border-neutral-450 flex w-full flex-col items-stretch justify-between gap-3 rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm font-bold text-neutral-800 sm:flex-row sm:items-center dark:bg-neutral-950 dark:fill-neutral-200 dark:text-neutral-200'>
        <div className='flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center'>
          {/* Collapse/Expand Button */}
          <div className='hidden justify-between sm:flex sm:justify-start sm:pl-2'>
            {expanded ? (
              <button
                className='flex cursor-pointer items-center gap-2 hover:underline sm:gap-4'
                onClick={() => {
                  setView(ViewEnum.FULL);
                  setExpanded(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label='Collapse proposal'
              >
                <ArrowSvg width={20} height={20} />
                <div className='text-sm'>Collapse Proposal</div>
              </button>
            ) : (
              <button
                className='flex cursor-pointer items-center gap-2 hover:underline sm:gap-4'
                onClick={() => {
                  setView(ViewEnum.BODY);
                  setExpanded(true);
                }}
                aria-label='Read proposal'
              >
                <ArrowSvg className='rotate-180' width={20} height={20} />
                <div className='text-sm'>Read Proposal</div>
              </button>
            )}
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
