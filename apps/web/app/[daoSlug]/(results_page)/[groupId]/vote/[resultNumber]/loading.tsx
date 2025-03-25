import { ResultsLoading } from './components/results';
import { LoadingTimeline } from './components/timeline/timeline';

import ArrowSvg from '@/public/assets/web/arrow.svg';

export default function Loading() {
  return (
    <div className='flex min-h-screen w-full flex-row'>
      <LoadingHeaderPlaceholder />
      <LoadingTimeline />

      <div
        className={
          'flex w-full grow -translate-x-[1px] py-2 sm:-translate-y-2 sm:py-28'
        }
      >
        <div className='h-full w-full pr-2 pl-2 sm:pr-4 sm:pl-0'>
          <div className='dark:border-neutral-650 flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-r-xs border border-neutral-800 bg-white p-6 dark:bg-neutral-950'>
            <ResultsLoading />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingHeaderPlaceholder() {
  return (
    <div
      className={`border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 flex h-20 items-center border-b bg-neutral-50 px-2 transition-transform duration-300 sm:ml-20 sm:px-6 dark:bg-neutral-900`}
    >
      {/* Back Button Placeholder */}
      <div className='flex items-center gap-2 rounded-full px-3 py-2'>
        <ArrowSvg className='-rotate-90' width={24} height={24} />
        <span className='hidden text-sm font-medium sm:block'>Back</span>
      </div>

      <div className={'flex items-center gap-2 pl-2 sm:pl-4'}>
        {/* Avatar Placeholder */}
        <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
          <div className='h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700' />
        </div>
        {/* Group Name Placeholder */}
        <div className='h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
      </div>
    </div>
  );
}
