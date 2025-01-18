"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LazyLoadTrigger({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // Increment the page query parameter
          const nextPage = currentPage + 1;
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.set("page", nextPage.toString());
          router.replace(`?${newSearchParams.toString()}`, { scroll: false });
        }
      },
      { threshold: 0.5 }, // Trigger when 50% of the element is visible
    );

    const trigger = document.getElementById("lazy-load-trigger");
    if (trigger) {
      observer.observe(trigger);
    }

    return () => {
      if (trigger) {
        observer.unobserve(trigger);
      }
    };
  }, [currentPage, searchParams, router]);

  return (
    <div
      id="lazy-load-trigger"
      className="flex items-center justify-center p-6"
    >
      <div className="h-12 w-12" />
    </div>
  );
}
