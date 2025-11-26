'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Onboarding page error:', error);
  }, [error]);

  return (
    <div className='flex min-h-[50vh] w-full flex-col items-center justify-center px-4'>
      <div className='max-w-md text-center'>
        <h2 className='mb-4 text-2xl font-bold text-neutral-800 dark:text-neutral-100'>
          Onboarding error
        </h2>
        <p className='mb-6 text-neutral-600 dark:text-neutral-400'>
          {process.env.NODE_ENV === 'development' ? (
            <>
              <span className='block font-mono text-sm'>{error.message}</span>
              {error.digest && (
                <span className='mt-2 block text-xs'>
                  Error ID: {error.digest}
                </span>
              )}
            </>
          ) : (
            'Something went wrong during onboarding. Please try again.'
          )}
        </p>
        <div className='flex flex-col gap-3 sm:flex-row sm:justify-center'>
          <button
            onClick={reset}
            className='rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-800 dark:hover:bg-neutral-300'
          >
            Try again
          </button>
          <Link
            href='/'
            className='rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
