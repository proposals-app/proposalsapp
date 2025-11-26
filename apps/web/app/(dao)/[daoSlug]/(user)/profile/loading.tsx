export default function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <main className='w-full py-4 sm:py-6 md:py-10'>
          {/* Welcome Header skeleton */}
          <div className='mb-8 text-center'>
            <div className='mx-auto mb-2 h-9 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
            <div className='mx-auto h-6 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          </div>

          {/* Settings sections skeleton */}
          <div className='mb-8'>
            <div className='h-8 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
            <div className='mt-4 space-y-4'>
              <div className='h-12 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
              <div className='h-12 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
            </div>
          </div>
          <div className='mb-8'>
            <div className='h-8 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
            <div className='mt-4 h-24 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          </div>
        </main>
      </div>
    </div>
  );
}
