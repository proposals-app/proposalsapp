export default function Loading() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-48 rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-64 w-full rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
    </div>
  );
}
