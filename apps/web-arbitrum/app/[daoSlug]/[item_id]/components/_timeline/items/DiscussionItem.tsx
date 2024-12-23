import Link from "next/link";
import { DiscussionContent } from "../types";
import { useState } from "react";

interface DiscussionItemProps {
  content: DiscussionContent;
  timestamp: Date;
}

export function DiscussionItem({ content, timestamp }: DiscussionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Function to toggle the expanded state
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          {timestamp.toLocaleString()}
        </span>
        <span className="rounded-full bg-yellow-400 px-2 py-1 text-xs font-medium">
          Discussion
        </span>
      </div>
      {content.topicTitle ? (
        <>
          <h3 className="font-medium">{content.topicTitle}</h3>
          <div className="mt-2">
            <span className="font-medium text-gray-700">
              {content.username}:
            </span>
            {/* Container for the body text with max-height when collapsed */}
            <div
              className={`prose prose-sm mt-1 max-w-none ${
                isExpanded ? "max-h-none" : "max-h-40 overflow-hidden"
              }`}
              dangerouslySetInnerHTML={{ __html: content.cooked || "" }}
            />
          </div>
        </>
      ) : (
        <Link
          href={`${content.discourseBaseUrl}/t/${content.externalId}`}
          target="_blank"
          className="text-lg font-medium hover:underline"
        >
          {content.title}
        </Link>
      )}

      {/* Show More/Less button */}
      {!isExpanded && content.cooked ? (
        <button
          onClick={toggleExpand}
          className="mt-2 flex w-full justify-center text-sm font-medium text-blue-500 hover:underline"
        >
          + Show More
        </button>
      ) : isExpanded ? (
        <button
          onClick={toggleExpand}
          className="mt-2 flex w-full justify-center text-sm font-medium text-blue-500 hover:underline"
        >
          - Show Less
        </button>
      ) : null}
    </div>
  );
}
