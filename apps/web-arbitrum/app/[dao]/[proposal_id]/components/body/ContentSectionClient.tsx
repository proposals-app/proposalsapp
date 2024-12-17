"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

const ContentSectionClient = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      const fullHeight = contentRef.current.scrollHeight;
      setMaxHeight(fullHeight);
    }
  }, [content]);

  return (
    <div className="relative min-h-screen pb-16">
      {/* Added min-h-screen and pb-16 for spacing */}
      <div
        ref={contentRef}
        className={`relative transition-all duration-500 ease-in-out ${
          isExpanded ? "" : "max-h-[25%] overflow-hidden"
        }`}
        style={{
          maxHeight: isExpanded ? `${maxHeight}px` : `${maxHeight / 4}px`,
        }}
      >
        {content}

        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent" />
        )}
      </div>
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-4 flex w-full cursor-pointer items-center justify-start gap-2 rounded-full border bg-white p-2 text-sm font-bold"
        >
          <ArrowDown className="p1 rounded-full border p-1" />
          Read Full Proposal
        </button>
      )}
      {isExpanded && (
        <button
          onClick={() => setIsExpanded(false)}
          className="animate-slide-up fixed bottom-0 left-4 right-4 z-50 mx-auto flex w-full max-w-[600px] cursor-pointer items-center justify-between gap-2 rounded-t-xl border bg-white p-2 text-sm font-bold shadow-lg"
        >
          <ArrowUp className="p1 rounded-full border p-1" />
          <div className="flex flex-row items-center gap-2">
            Comments and Votes
            <ArrowDown className="p1 rounded-full border p-1" />
          </div>
        </button>
      )}
    </div>
  );
};

export default ContentSectionClient;
