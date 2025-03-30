import { LoadingGroupList } from './components/group-list';
import { LoadingHeader } from './page';

export function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <LoadingHeader />
        {/* Action Bar Skeleton */}
        <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <div className='h-8 w-48 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
          <div className='h-8 w-32 animate-pulse bg-neutral-200 dark:bg-neutral-700'></div>
        </div>
        {/* Groups List Skeleton */}
        <LoadingGroupList />
      </div>{' '}
    </div>
  );
}
