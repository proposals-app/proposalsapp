'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface LazyLoadTriggerProps {
  currentPage: number;
  hasMore?: boolean; // Add this prop to control if there's more content
}

export function LazyLoadTrigger({
  currentPage,
  hasMore = true, // Default to true for backward compatibility
}: LazyLoadTriggerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // If there's no more content to load, don't set up the observer
    if (!hasMore) return;

    // Check if content height is less than viewport height
    const contentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const isContentShorterThanViewport = contentHeight <= viewportHeight;

    // Only set up observer if content is taller than viewport
    if (!isContentShorterThanViewport) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting) {
            // Increment the page query parameter
            const nextPage = currentPage + 1;
            const newSearchParams = new URLSearchParams(
              searchParams.toString()
            );
            newSearchParams.set('page', nextPage.toString());
            router.replace(`?${newSearchParams.toString()}`, { scroll: false });
          }
        },
        {
          threshold: 0.1,
          rootMargin: '100px', // Add some margin to trigger loading earlier
        }
      );

      if (triggerRef.current) {
        observerRef.current.observe(triggerRef.current);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [currentPage, searchParams, router, hasMore]);

  if (!hasMore) {
    return null;
  }

  return (
    <div
      ref={triggerRef}
      id='lazy-load-trigger'
      className='flex items-center justify-center p-6'
    >
      <div className='h-12 w-12' />
    </div>
  );
}
