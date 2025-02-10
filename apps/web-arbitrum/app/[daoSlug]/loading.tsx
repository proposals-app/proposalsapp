export default function Loading() {
  return (
    <div className='flex min-h-screen w-full flex-row'>
      {/* Main content area with padding matching the actual content */}
      <div className='w-full p-8'>
        {/* Skeleton for the DAO name heading */}
        <div className='mb-8 h-10 w-64 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700' />

        {/* Skeleton for the group list */}
        <div className='space-y-2'>
          {/* Generate multiple skeleton items to simulate the list */}
          {[...Array(12)].map((_, index) => (
            <div
              key={index}
              className='flex h-24 flex-col space-y-4 rounded-xs border border-neutral-200 p-4
                dark:border-neutral-700'
            >
              {/* Title skeleton */}
              <div className='h-6 w-3/4 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700' />

              {/* Description skeleton */}
              <div className='space-y-2'>
                <div className='h-4 w-5/6 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
