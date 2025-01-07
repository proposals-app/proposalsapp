"use client";

import { useEffect, useRef, useState } from "react";
import { parseAsInteger, useQueryState } from "nuqs";

export function LazyLoadTrigger() {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
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
      { threshold: 0.5 }, // Adjust the threshold as needed
    );

    if (triggerRef.current) {
      observer.observe(triggerRef.current);
    }

    return () => {
      if (triggerRef.current) {
        observer.unobserve(triggerRef.current);
      }
    };
  }, [page, setPage, wasOutOfView]);

  return (
    <div ref={triggerRef} className="flex items-center justify-center p-6">
      <div className="relative">
        {/* Outer spinning ring */}
        <div className="h-12 w-12 animate-[spin_1s_linear_infinite] rounded-full border-4 border-gray-200 border-t-gray-500" />
      </div>
    </div>
  );
}
