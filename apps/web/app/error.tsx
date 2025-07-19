'use client';

import { useEffect } from 'react';

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-4'>
      <div className='mx-auto max-w-md text-center'>
        <h1 className='mb-4 text-4xl font-bold'>Something went wrong!</h1>
        <p className='text-muted-foreground mb-8'>
          {process.env.NODE_ENV === 'development' ? (
            <>
              <span className='font-mono text-sm'>{error.message}</span>
              {error.digest && (
                <span className='mt-2 block text-xs'>
                  Error ID: {error.digest}
                </span>
              )}
            </>
          ) : (
            'An unexpected error occurred. Please try again.'
          )}
        </p>
      </div>
    </div>
  );
}
