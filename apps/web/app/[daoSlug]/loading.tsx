export default function Loading() {
  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='flex w-full flex-col gap-2 p-8'>
        {/* Skeleton loader for the DAO name */}
        <div className='mb-8 h-12 w-80 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>

        {/* Skeleton loader for MarkAllAsReadButton - align right */}
        <div className='mb-4 self-end'>
          <div className='h-8 w-32 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
        </div>

        {/* Skeleton loaders for the group list items, more like cards */}
        <div className='space-y-4'>
          {Array(12) // Adjust number of loading items as needed, 4 seems reasonable
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className='flex space-x-4 border border-neutral-200 bg-neutral-50 p-4
                  dark:border-neutral-700 dark:bg-neutral-900'
              >
                {/* Avatar Skeleton */}
                <div className='h-12 w-12 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700'></div>

                <div className='flex flex-col justify-center space-y-2'>
                  {/* Group Name Skeleton */}
                  <div className='h-6 w-64 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
                  {/* Meta info line (Date, Counts) Skeleton */}
                  <div className='flex space-x-2'>
                    <div className='h-4 w-24 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
                    <div className='h-4 w-16 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
