"use client";

import { parseAsBoolean, useQueryState } from "nuqs";

const COLLAPSED_HEIGHT = "25rem";

import React, { memo } from "react";

const BodyContent = memo(
  ({ processedContent }: { processedContent: string }) => {
    const [expanded, _] = useQueryState(
      "expanded",
      parseAsBoolean.withDefault(false),
    );

    return (
      <div
        className={`relative transition-all duration-500 ease-in-out ${
          expanded ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{
          maxHeight: expanded ? "none" : COLLAPSED_HEIGHT,
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: processedContent }}
          className="diff-content prose prose-lg max-w-none"
        />
        {!expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
    );
  },
);

BodyContent.displayName = "BodyContent";
export { BodyContent };
