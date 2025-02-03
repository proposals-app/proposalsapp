'use client';

import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import * as Popover from '@radix-ui/react-popover';
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';
import { voteFilters } from './MenuBar';
import Image from 'next/image';

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
      className={`fixed top-0 z-50 mt-24 min-w-4xl self-center px-4 pb-4 transition-opacity
        duration-300 ${view === ViewEnum.COMMENTS ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='flex w-full items-center justify-between gap-2 border bg-white p-2 text-sm
          font-bold shadow-lg'
      >
        <div className='flex w-full justify-between'>
          <button
            className='flex cursor-pointer items-center gap-4 hover:underline'
            onClick={() => {
              setView(ViewEnum.BODY);
              setExpanded(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Image src='/assets/web/arrow.svg' alt='' width={24} height={24} />
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
                    <Image
                      src='/assets/web/checkbox_check.svg'
                      alt=''
                      width={24}
                      height={24}
                    />
                  ) : (
                    <Image
                      src='/assets/web/checkbox_nocheck.svg'
                      alt=''
                      width={24}
                      height={24}
                    />
                  )}
                </div>
                Show comments
              </label>
            </div>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button className='flex h-8 w-[200px] items-center justify-between px-3 text-sm'>
                  {voteFilters.find((filter) => filter.value === votesFilter)
                    ?.label || 'Select vote filter...'}
                  <Image
                    src='/assets/web/chevron_down.svg'
                    alt=''
                    width={24}
                    height={24}
                  />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className='w-[200px] border bg-neutral-50 p-1 shadow-lg'
                sideOffset={5}
              >
                <div className='space-y-1'>
                  {voteFilters.map((filter) => (
                    <button
                      key={filter.value}
                      className='flex w-full items-center justify-between px-2 py-1.5 text-sm transition-colors
                        hover:bg-neutral-100'
                      onClick={() => {
                        setVotesFilter(filter.value as VotesFilterEnum);
                      }}
                    >
                      {filter.label}
                      {votesFilter === filter.value && (
                        <Image
                          src='/assets/web/check.svg'
                          alt=''
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
