export const LoadingMenuBar = () => {
  return (
    <div className='font-condensed z-[999] flex w-full justify-center'>
      <div className='mt-4 min-w-4xl self-center overflow-visible px-2 opacity-100'>
        <div className='dark:border-neutral-450 flex w-full items-center justify-between gap-2 rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm font-bold text-neutral-800 dark:bg-neutral-950 dark:fill-neutral-200 dark:text-neutral-200'>
          <div className='flex w-full justify-between'>
            <div className='flex items-center gap-4'>
              <div className='h-6 w-6 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700'></div>
              <div className='h-5 w-32 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700'></div>
            </div>

            <div className='flex space-x-2'>
              <div className='h-8 w-44 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700'></div>
              <div className='h-8 w-44 animate-pulse rounded-xs bg-neutral-200 dark:bg-neutral-700'></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
