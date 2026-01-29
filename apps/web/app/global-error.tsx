'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang='en'>
      <body>
        <div className='flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900'>
          <div className='px-4 text-center'>
            <h2 className='text-xl font-semibold text-neutral-900 dark:text-neutral-100'>
              Something went wrong!
            </h2>
            {error.digest && (
              <p className='mt-2 text-sm text-neutral-500 dark:text-neutral-400'>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              className='mt-4 rounded bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300'
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
