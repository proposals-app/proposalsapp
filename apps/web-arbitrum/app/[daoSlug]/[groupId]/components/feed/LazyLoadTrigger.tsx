'use client';

import { parseAsInteger, useQueryState } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

export function LazyLoadTrigger() {
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1).withOptions({ shallow: false })
  );
  const [wasOutOfView, setWasOutOfView] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (wasOutOfView) {
            // Set a timeout to add hysteresis
            const timeoutId = setTimeout(() => {
              if (entry.isIntersecting) {
                setPage(page + 1);
                setWasOutOfView(false); // Reset the state after increasing the page
              }
            }, 1000); // 1000ms delay for hysteresis

            // Cleanup the timeout if the element is no longer intersecting
            return () => clearTimeout(timeoutId);
          }
        } else {
          // Mark that the component was out of view
          setWasOutOfView(true);
        }
      },
      { threshold: 0.5 } // Adjust the threshold as needed
    );

    if (triggerRef.current) {
      observer.observe(triggerRef.current);
    }

    const currentTrigger = triggerRef.current;
    return () => {
      if (currentTrigger) {
        observer.unobserve(currentTrigger);
      }
    };
  }, [page, setPage, wasOutOfView]);

  return (
    <div ref={triggerRef} className='flex items-center justify-center p-6'>
      <div className='h-12 w-12' />
    </div>
  );
}
