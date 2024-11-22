import Link from "next/link";
import { ProposalContent } from "../types";
import { useState } from "react";

interface ProposalItemProps {
  content: ProposalContent;
  timestamp: Date;
}

export function ProposalItem({ content, timestamp }: ProposalItemProps) {
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
        <span className="rounded-full bg-green-400 px-2 py-1 text-xs font-medium">
          Proposal
        </span>
      </div>
      <Link
        href={content.url}
        target="_blank"
        className="text-lg font-medium hover:underline"
      >
        {content.name}
      </Link>

      {/* Container for the body text with max-height when collapsed */}
      <div
        className={`mt-2 whitespace-pre-wrap text-sm ${
          isExpanded ? "max-h-none" : "max-h-40 overflow-hidden"
        }`}
      >
        {content.body.split("\n").map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>

      {/* Show More/Less button */}
      {!isExpanded && content.body.split("\n").length > 10 ? (
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
