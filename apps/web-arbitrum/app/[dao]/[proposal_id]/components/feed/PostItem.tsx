import { CombinedFeedItem, PostFeedItem } from "./Feed";
import { toHast } from "mdast-util-to-hast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "hast-util-to-string";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

const isPostItem = (item: CombinedFeedItem): item is PostFeedItem => {
  return item.type === "post";
};

export const PostItem = ({ item }: { item: CombinedFeedItem }) => {
  if (!isPostItem(item)) {
    return null;
  }

  const processedContent = markdownToHtml(item.cooked);

  return (
    <div>
      <h3>{item.timestamp.toLocaleString()}</h3>
      <p>Posted by: {item.username || "Unknown"}</p>
      <div
        dangerouslySetInnerHTML={{ __html: processedContent }}
        className={`prose prose-lg max-w-none`}
      />
    </div>
  );
};

// Define allowed tag names type
type MarkdownStyleKeys = keyof typeof MARKDOWN_STYLES;

// Define the Node interface
interface HastNode {
  tagName?: string;
  properties?: {
    className?: string;
    [key: string]: any;
  };
  children?: HastNode[];
  type?: string;
}

const MARKDOWN_STYLES = {
  h1: "mb-4 mt-6 text-2xl font-bold",
  h2: "mb-3 mt-5 text-xl font-bold",
  h3: "mb-2 mt-4 text-lg font-bold",
  p: "mb-4 leading-relaxed",
  ul: "mb-4 list-disc space-y-2 pl-6",
  ol: "mb-4 list-decimal space-y-2 pl-6",
  li: "leading-relaxed",
  strong: "font-bold",
  a: "underline",
  blockquote: "border-l-4 border-gray-300 pl-4 italic",
  table: "min-w-full border-collapse border border-gray-300 my-4",
  th: "border border-gray-300 bg-gray-100 p-2 text-left",
  td: "border border-gray-300 p-2",
  img: "my-4 h-auto max-w-full",
} as const;

function applyStyleToNode(node: HastNode): void {
  if (!node || typeof node !== "object") return;

  // Type guard to check if tagName is a valid key of MARKDOWN_STYLES
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

    return html;
  } catch (error) {
    console.error("Error converting markdown to HTML:", error);
    return "<div>Error processing content</div>";
  }
}
