import {
  LoadingHeader,
  SkeletonActionBar,
  LoadingGroupList,
} from '@/app/components/ui/skeleton';

export default function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <LoadingHeader />
        <SkeletonActionBar />
        <LoadingGroupList />
      </div>
    </div>
  );
}
