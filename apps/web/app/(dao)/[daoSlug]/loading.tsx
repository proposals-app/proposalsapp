import {
  SkeletonText,
  SkeletonButton,
  SkeletonAvatar,
} from '../../components/ui/skeleton';

export default function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <LoadingHeader />

        {/* Enhanced Action Bar Skeleton */}
        <div className='flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <SkeletonText width='12rem' size='xl' />
          <SkeletonButton size='md' />
        </div>

        {/* Enhanced Groups List Skeleton */}
        <LoadingGroupList />
      </div>
    </div>
  );
}

export function LoadingHeader() {
  return (
    <div className='mb-8 overflow-hidden rounded-xs border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800/50'>
      {/* Mobile layout skeleton */}
      <div className='md:hidden'>
        {/* Header with profile picture */}
        <div className='p-6'>
          <div className='flex flex-row items-center space-x-4'>
            <div className='relative flex h-12 w-12 animate-pulse items-center justify-center rounded-full border border-neutral-200 bg-neutral-200 p-4 sm:h-16 sm:w-16 dark:border-neutral-700 dark:bg-neutral-700'></div>

            <div className='flex-1'>
              <div className='h-6 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
              <div className='mt-2 h-4 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
            </div>
          </div>
        </div>

        {/* Primary metrics row */}
        <div className='grid grid-cols-3 border-t border-neutral-200 dark:border-neutral-700'>
          {['Active', 'Proposals', 'Discussions'].map((label) => (
            <div
              key={label}
              className='border-r border-neutral-200 last:border-r-0 dark:border-neutral-700'
            >
              <div
                className={`flex animate-pulse flex-col items-center justify-center bg-white p-4 text-center dark:bg-neutral-800/50`}
              >
                <div className='mb-1 h-6 w-8 bg-neutral-200 dark:bg-neutral-700'></div>
                <div className='h-4 w-12 bg-neutral-200 dark:bg-neutral-700'></div>
              </div>
            </div>
          ))}
        </div>

        {/* Financial metrics row */}
        <div className='grid grid-cols-3 border-t border-neutral-200 dark:border-neutral-700'>
          {['Token Price', 'Market Cap', 'Treasury'].map((label) => (
            <div
              key={label}
              className='border-r border-neutral-200 last:border-r-0 dark:border-neutral-700'
            >
              <div
                className={`flex animate-pulse flex-col items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-900/20`}
              >
                <div className='mb-1 h-6 w-10 bg-neutral-200 dark:bg-neutral-700'></div>
                <div className='h-4 w-14 bg-neutral-200 dark:bg-neutral-700'></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop layout skeleton (hidden on mobile) */}
      <div className='hidden md:block'>
        <div className='grid grid-cols-5 grid-rows-3'>
          {/* Profile picture, name and description (spans col 1-3, rows 1-2) */}
          <div className='col-span-3 row-span-2 p-6'>
            <div className='flex flex-row items-center space-x-8'>
              <div className='relative flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-neutral-200 bg-neutral-200 p-4 dark:border-neutral-700 dark:bg-neutral-700'></div>

              <div className='flex-1'>
                <div className='h-8 w-48 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
                <div className='mt-2 h-4 w-48 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
              </div>
            </div>
          </div>

          {/* Column 4 is empty and auto-adjusts - no border */}
          <div className='col-start-4 col-end-5 row-span-3'></div>

          {/* Financial metrics in column 5 */}
          {['Token Price', 'Voting Power', 'Treasury'].map((label, index) => (
            <div
              key={label}
              className={`col-start-5 col-end-6 row-start-${index + 1} row-end-${index + 2} border-b border-l border-neutral-200 dark:border-neutral-700 ${index === 2 ? 'border-b-0' : ''}`}
            >
              <div
                className={`flex animate-pulse flex-col items-center justify-center p-4 ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900/20' : 'bg-white dark:bg-neutral-800/50'}`}
              >
                <div className='mb-1 h-6 w-10 bg-neutral-200 dark:bg-neutral-700'></div>
                <div className='h-4 w-14 bg-neutral-200 dark:bg-neutral-700'></div>
              </div>
            </div>
          ))}

          {/* Primary metrics in row 3, columns 1-3 */}
          {['Active', 'Proposals', 'Discussions'].map((label, index) => (
            <div
              key={label}
              className={`col-start-${index + 1} col-end-${index + 2} row-start-3 row-end-4 border-t border-r border-neutral-200 dark:border-neutral-700`}
            >
              <div
                className={`flex animate-pulse flex-col items-center justify-center p-4 text-center ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900/20' : 'bg-white dark:bg-neutral-800/50'}`}
              >
                <div className='mb-1 h-6 w-8 bg-neutral-200 dark:bg-neutral-700'></div>
                <div className='h-4 w-12 bg-neutral-200 dark:bg-neutral-700'></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoadingGroupList() {
  return (
    <div className='space-y-4'>
      {Array(24)
        .fill(0)
        .map((_, index) => (
          <LoadingGroupItem key={index} />
        ))}
    </div>
  );
}

export function LoadingGroupItem() {
  return (
    <div className='flex space-x-4 border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-700 dark:bg-neutral-900'>
      {/* Enhanced Avatar Skeleton */}
      <SkeletonAvatar size='md' className='sm:h-10 sm:w-10' />

      <div className='flex w-full flex-col justify-center space-y-2'>
        {/* Enhanced Group Name Skeleton */}
        <SkeletonText width='12rem' size='md' />
        {/* Enhanced Author Name Skeleton */}
        <SkeletonText width='8rem' size='sm' />
        {/* Enhanced Meta info line Skeleton */}
        <div className='mt-2 flex flex-wrap gap-2'>
          <SkeletonText width='3rem' size='xs' />
          <SkeletonText width='4rem' size='xs' />
        </div>
      </div>
    </div>
  );
}
