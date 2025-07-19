'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
        <p className="text-muted-foreground mb-8">
          {process.env.NODE_ENV === 'development' ? (
            <>
              <span className="font-mono text-sm">{error.message}</span>
              {error.digest && (
                <span className="block mt-2 text-xs">
                  Error ID: {error.digest}
                </span>
              )}
            </>
          ) : (
            'An unexpected error occurred. Please try again.'
          )}
        </p>
        <Button
          onClick={() => reset()}
          variant="default"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}