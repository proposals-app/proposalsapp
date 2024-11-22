import Link from "next/link";
import { ProposalContent } from "../types";

interface ProposalItemProps {
  content: ProposalContent;
  timestamp: Date;
}

export function ProposalItem({ content, timestamp }: ProposalItemProps) {
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
      <p className="mt-2 whitespace-pre-wrap text-sm">{content.body}</p>
    </div>
  );
}
