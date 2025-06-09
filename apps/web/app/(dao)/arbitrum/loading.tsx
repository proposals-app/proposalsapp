import { LoadingGroupList, LoadingHeader } from '../[daoSlug]/loading';

export default function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <LoadingHeader />
        <div className='mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <div className='h-8 w-48 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800'></div>
        </div>
        <LoadingGroupList />
      </div>
    </div>
  );
}
