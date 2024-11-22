import Link from "next/link";
import { DiscussionContent } from "../types";

interface DiscussionItemProps {
  content: DiscussionContent;
  timestamp: Date;
}

export function DiscussionItem({ content, timestamp }: DiscussionItemProps) {
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
            <div
              className="prose prose-sm mt-1 max-w-none"
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
    </div>
  );
}
