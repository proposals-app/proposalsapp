'use client';

import { useEffect, useState } from 'react';
import { LoadingGroupList, HeaderSkeleton } from '@/app/components/ui/skeleton';

export function SafariLoadingFallback({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Show fallback if content doesn't load within 100ms
    const timer = setTimeout(() => {
      if (isLoading) {
        setShowFallback(true);
      }
    }, 100);

    // Mark as loaded when component mounts (children are rendered)
    setIsLoading(false);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (showFallback && isLoading) {
    return (
      <>
        <HeaderSkeleton />
        <LoadingGroupList />
      </>
    );
  }

  return <>{children}</>;
}
