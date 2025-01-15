import { CombinedFeedItem, PostFeedItem } from "../Feed";
import { toHast } from "mdast-util-to-hast";
import { fromMarkdown } from "mdast-util-from-markdown";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { format, formatDistanceToNowStrict, formatISO } from "date-fns";
import { getDiscourseUser } from "../actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { Suspense } from "react";

const isPostItem = (item: CombinedFeedItem): item is PostFeedItem => {
  return item.type === "post";
};

export async function PostItem({ item }: { item: CombinedFeedItem }) {
  if (!isPostItem(item)) {
    return null;
  }

  const author = await getDiscourseUser(item.userId, item.daoDiscourseId);

  const processedContent = markdownToHtml(item.cooked);
  const postAnchorId = `post-${item.postNumber}-${item.topicId}`;
  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.timestamp),
    {
      addSuffix: true,
    },
  );
  const relativeUpdateTime = formatDistanceToNowStrict(
    new Date(item.updatedAt),
    {
      addSuffix: true,
    },
  );
  const utcTime = format(
    formatISO(item.timestamp),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  return (
    <div id={postAnchorId} className="w-full scroll-mt-36 p-4">
      <div className="flex cursor-default select-none flex-row justify-between">
        {author && (
          <Suspense>
            <AuthorInfo
              authorName={
                author.name && author.name.length
                  ? author.name
                  : author.username
              }
              authorPicture={author.avatarTemplate}
            />
          </Suspense>
        )}
        <div className="flex cursor-default select-none flex-col items-end text-sm text-gray-500">
          <div className="flex flex-col items-end text-sm text-gray-500">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    posted{" "}
                    <span className="font-bold">{relativeCreateTime}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{utcTime}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {item.timestamp.getTime() != item.updatedAt.getTime() && (
            <div>
              <span>edited {relativeUpdateTime}</span>
            </div>
          )}
        </div>
      </div>

      <div
        dangerouslySetInnerHTML={{ __html: processedContent }}
        className={`prose prose-lg mt-4 max-w-none`}
      />
    </div>
  );
}

const AuthorInfo = ({
  authorName,
  authorPicture,
}: {
  authorName: string;
  authorPicture: string;
}) => (
  <div className="flex flex-row items-center gap-2">
    <Avatar className="bg-gray-500">
      <AvatarImage src={authorPicture} />
      <AvatarFallback>{authorName.slice(0, 2)}</AvatarFallback>
    </Avatar>
    <div className="font-bold">{authorName}</div>
  </div>
);

// Quote card styles
const QUOTE_STYLES = {
  wrapper: "my-4 border-l-2 border-gray-200 p-4",
  header: "flex text-sm text-gray-600 mb-2 font-bold",
  content: "text-gray-800",
  linkWrapper: "w-full flex justify-end mt-2 cursor-default select-none",
  link: "text-gray-500 hover:underline text-sm font-bold no-underline",
} as const;

const MARKDOWN_STYLES = {
  h1: "mb-4 mt-6 text-2xl font-bold",
  h2: "mb-3 mt-5 text-xl font-bold",
  h3: "mb-2 mt-4 text-lg font-bold",
  p: "mb-4 leading-relaxed",
  ul: "mb-4 list-disc space-y-2 pl-6",
  ol: "mb-4 list-decimal space-y-2 pl-6",
  li: "leading-relaxed",
  strong: "font-bold",
  a: "underline text-blue-600 hover:text-blue-800",
  blockquote: "border-l-4 border-gray-300 pl-4 italic",
  table: "min-w-full border-collapse border border-gray-300 my-4",
  th: "border border-gray-300 bg-gray-100 p-2 text-left",
  td: "border border-gray-300 p-2",
  img: "my-4 h-auto max-w-full",
} as const;

type MarkdownStyleKeys = keyof typeof MARKDOWN_STYLES;

// Process quotes after HTML conversion
function processQuotes(html: string): string {
  if (!html.includes('[quote="')) return html;
  // Helper function to create a quote HTML structure
  function createQuoteHtml(
    username: string,
    postNumber: string,
    topicId: string,
    content: string,
  ) {
    const anchorHref =
      postNumber === "1" ? "#" : `#post-${postNumber}-${topicId}`;
    return `
      <div class="${QUOTE_STYLES.wrapper}">
        <div class="${QUOTE_STYLES.header}">
          <span>Quoted from&nbsp;</span>
          <span>${username}</span>
        </div>
        <div class="${QUOTE_STYLES.content}">
          ${content.trim()}
        </div>
        <div class="${QUOTE_STYLES.linkWrapper}">
          <a href="${anchorHref}" class="${QUOTE_STYLES.link}">
                    ${postNumber === "1" ? "back to top ↑" : "jump to post →"}
          </a>
        </div>
      </div>
    `;
  }

  // Find the innermost quote first
  let processedHtml = html;
  let wasProcessed = true;

  while (wasProcessed) {
    wasProcessed = false;

    // Process one level of quotes at a time, starting with the innermost
    processedHtml = processedHtml.replace(
      /\[quote="([^,]+),\s*post:(\d+),\s*topic:(\d+)(?:,\s*full:\w+)?"]((?!\[quote=)[\s\S]*?)\[\/quote\]/g,
      (_, username, postNumber, topicId, content) => {
        wasProcessed = true;
        return createQuoteHtml(username, postNumber, topicId, content);
      },
    );
  }

  return processedHtml;
}

// Define interfaces
interface HastNode {
  type?: string;
  tagName?: string;
  properties?: {
    className?: string;
    [key: string]: any;
  };
  children?: HastNode[];
  value?: string;
}

function applyStyleToNode(node: HastNode): void {
  if (!node || typeof node !== "object") return;

  if (
    node.tagName &&
    Object.prototype.hasOwnProperty.call(MARKDOWN_STYLES, node.tagName)
  ) {
    const tagName = node.tagName as MarkdownStyleKeys;
    node.properties = node.properties || {};
    node.properties.className = node.properties.className
      ? `${node.properties.className} ${MARKDOWN_STYLES[tagName]}`
      : MARKDOWN_STYLES[tagName];
  }

  // Recursively process children
  if (Array.isArray(node.children)) {
    node.children.forEach(applyStyleToNode);
  }
}

function markdownToHtml(markdown: string): string {
  try {
    // First convert markdown to HTML
    const mdast = fromMarkdown(markdown);
    const hast = toHast(mdast);

    if (hast) {
      applyStyleToNode(hast);
    }

    const html = unified()
      .use(rehypeStringify, {
        closeSelfClosing: true,
        allowDangerousHtml: true,
      })
      .stringify(hast as any);

    // Process quotes after HTML conversion
    return processQuotes(html);
  } catch (error) {
    console.error("Error converting markdown to HTML:", error);
    return "<div>Error processing content</div>";
  }
}
