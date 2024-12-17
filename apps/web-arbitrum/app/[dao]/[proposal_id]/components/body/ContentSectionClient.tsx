"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

const ContentSectionClient = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(0);

  // Update viewport height on mount and window resize
  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    // Initial setup
    updateViewportHeight();

    // Add resize listener
    window.addEventListener("resize", updateViewportHeight);

    // Cleanup
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  // Calculate collapsed height (25% of viewport)
  const collapsedHeight = viewportHeight * 0.25;

  return (
    <div className="relative min-h-screen pb-16">
      <div
        ref={contentRef}
        className={`relative transition-all duration-500 ease-in-out ${
          !isExpanded && "overflow-hidden"
        }`}
        style={{
          maxHeight: isExpanded ? "100%" : `${collapsedHeight}px`,
        }}
      >
        <div className="prose max-w-none">{content}</div>

        {!isExpanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-4 flex w-full cursor-pointer items-center justify-start gap-2 rounded-full border bg-white p-2 text-sm font-bold transition-colors hover:bg-gray-50"
          aria-label="Expand proposal content"
        >
          <ArrowDown className="rounded-full border p-1" />
          Read Full Proposal
        </button>
      ) : (
        <button
          onClick={() => setIsExpanded(false)}
          className="animate-slide-up fixed bottom-0 left-4 right-4 z-50 mx-auto flex w-full max-w-[600px] cursor-pointer items-center justify-between gap-2 rounded-t-xl border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50"
          aria-label="Collapse proposal content"
        >
          <ArrowUp className="rounded-full border p-1" />
          <div className="flex flex-row items-center gap-2">
            Comments and Votes
            <ArrowDown className="rounded-full border p-1" />
          </div>
        </button>
      )}
    </div>
  );
};

export default ContentSectionClient;
