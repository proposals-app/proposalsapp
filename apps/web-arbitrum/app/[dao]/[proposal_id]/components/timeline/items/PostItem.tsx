import { PostContent } from "../types";

interface PostItemProps {
  content: PostContent;
  timestamp: Date;
}

export function PostItem({ content, timestamp }: PostItemProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          {timestamp.toLocaleString()}
        </span>
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium">
          Post
        </span>
      </div>
      <h3 className="font-medium">{content.topicTitle}</h3>
      <div className="mt-2">
        <span className="font-medium text-gray-700">{content.username}:</span>
        <div
          className="prose prose-sm mt-1 max-w-none"
          dangerouslySetInnerHTML={{ __html: content.cooked }}
        />
        {content.discourseBaseUrl && content.externalId && (
          <a
            href={`${content.discourseBaseUrl}/t/${content.externalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            View on Discourse →
          </a>
        )}
      </div>
    </div>
  );
}
