export default function Loading() {
  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='w-full p-8'>
        {/* Skeleton loader for the DAO name */}
        <div className='mb-8 h-10 w-64 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>

        {/* Skeleton loaders for the group list items */}
        <div className='space-y-4'>
          {Array(5)
            .fill(0)
            .map((_, index) => (
              <div key={index} className='flex flex-col space-y-2'>
                <div className='h-6 w-full max-w-md animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
                <div className='h-4 w-3/4 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
                <div className='h-12 w-full animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800'></div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
