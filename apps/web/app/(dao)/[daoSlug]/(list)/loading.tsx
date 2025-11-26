import {
  LoadingHeader,
  SkeletonActionBar,
  LoadingGroupList,
} from '@/app/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
        <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
          <LoadingHeader />
          <SkeletonActionBar />
          <LoadingGroupList />
        </div>
      </div>
      {/* Safari streaming fix: ensure content is > 1KB and has sufficient pixel height */}
      <div className='sr-only' aria-hidden='true'>
        {/* This invisible content ensures Safari triggers streaming properly */}
        {/* Safari requires at least 1024 bytes of content to start rendering */}
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={i} className='h-0 w-0 overflow-hidden'>
            Loading proposal groups for better Safari compatibility. This hidden
            content ensures the browser starts rendering immediately. Safari has
            specific requirements for streaming HTML that differ from other
            browsers. Content padding: {i}
          </div>
        ))}
      </div>
    </>
  );
}
