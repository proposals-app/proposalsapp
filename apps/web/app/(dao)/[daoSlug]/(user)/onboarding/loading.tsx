export default function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-md px-4 py-6'>
        <div className='animate-pulse space-y-6'>
          <div className='mx-auto h-10 w-64 rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-48 w-full rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-12 w-full rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
    </div>
  );
}
