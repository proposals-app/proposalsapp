"use client";

import DOMPurify from "isomorphic-dompurify";
import { ArrowDown, ArrowUp } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { toHtml } from "hast-util-to-html";
import { toHast } from "mdast-util-to-hast";
import { diff_match_patch, Diff } from "diff-match-patch";
import { Element, Text, Node, Root } from "hast";

interface ContentSectionClientProps {
  content: string;
  allBodies: Array<string>;
  version: number;
}

const COMMON_STYLES = {
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
  img: "my-4 h-auto max-w-full rounded-lg",
};

function applyStyle(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  Object.entries(COMMON_STYLES).forEach(([tag, className]) => {
    doc.querySelectorAll(tag).forEach((element) => {
      if (tag === "a") {
        element.setAttribute("rel", "noopener noreferrer");
        element.setAttribute("target", "_blank");
      }
      element.className = `${element.className} ${className}`.trim();
    });
  });

  return doc.body.innerHTML;
}

function markdownToHtml(markdown: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify);

  return applyStyle(
    DOMPurify.sanitize(String(processor.processSync(markdown))),
  );
}

// Helper type guards
function isElement(node: Node): node is Element {
  return node.type === "element";
}

function isText(node: Node): node is Text {
  return node.type === "text";
}

function generateDiff(previousTree: Node, currentTree: Node): Root {
  const dmp = new diff_match_patch();

  function wrapInSpan(node: Node, className?: string): Element {
    // Convert node's children to Element | Text only
    const children: (Element | Text)[] = isElement(node)
      ? node.children.filter(
          (child): child is Element | Text => isElement(child) || isText(child),
        )
      : isText(node)
        ? [node]
        : [];

    return {
      type: "element",
      tagName: "span",
      properties: { className },
      children,
    };
  }

  function compareTextNodes(prev: Text, curr: Text): (Element | Text)[] {
    const diffs = dmp.diff_main(prev.value, curr.value);
    dmp.diff_cleanupSemantic(diffs);

    return diffs.map((diff: Diff): Element | Text => {
      const [operation, text] = diff;
      const textNode: Text = { type: "text", value: text };

      switch (operation) {
        case -1: // Deletion
          return wrapInSpan(textNode, "diff-deleted");
        case 1: // Insertion
          return wrapInSpan(textNode, "diff-added");
        default: // No change
          return wrapInSpan(textNode);
      }
    });
  }

  function compareNodes(
    prev: Node | null,
    curr: Node | null,
  ): (Element | Text)[] {
    // If both nodes are null, return empty array
    if (!prev && !curr) return [];

    // If only current node exists, it's an addition
    if (!prev && curr) {
      return [wrapInSpan(curr, "diff-added")];
    }

    // If only previous node exists, it's a deletion
    if (prev && !curr) {
      return [wrapInSpan(prev, "diff-deleted")];
    }

    // At this point, both prev and curr are non-null
    const prevNode = prev!;
    const currNode = curr!;

    // Special handling for root nodes
    if (prevNode.type === "root" && currNode.type === "root") {
      const root = currNode as Root;
      const prevRoot = prevNode as Root;

      const newChildren: (Element | Text)[] = [];
      const maxLength = Math.max(
        root.children.length,
        prevRoot.children.length,
      );

      for (let i = 0; i < maxLength; i++) {
        const prevChild = prevRoot.children[i] || null;
        const currChild = root.children[i] || null;
        newChildren.push(...compareNodes(prevChild, currChild));
      }

      return newChildren;
    }

    // Both nodes exist but have different types
    if (prevNode.type !== currNode.type) {
      return [
        wrapInSpan(prevNode, "diff-deleted"),
        wrapInSpan(currNode, "diff-added"),
      ];
    }

    // Handle text nodes
    if (isText(prevNode) && isText(currNode)) {
      if (prevNode.value === currNode.value) {
        return [currNode];
      }
      return compareTextNodes(prevNode, currNode);
    }

    // Handle element nodes
    if (isElement(prevNode) && isElement(currNode)) {
      if (prevNode.tagName !== currNode.tagName) {
        return [
          wrapInSpan(prevNode, "diff-deleted"),
          wrapInSpan(currNode, "diff-added"),
        ];
      }

      // Same tag name, compare children
      const maxLength = Math.max(
        prevNode.children.length,
        currNode.children.length,
      );
      const newChildren: (Element | Text)[] = [];

      for (let i = 0; i < maxLength; i++) {
        const prevChild = prevNode.children[i] || null;
        const currChild = currNode.children[i] || null;
        newChildren.push(...compareNodes(prevChild, currChild));
      }

      return [
        {
          type: "element",
          tagName: currNode.tagName,
          properties: { ...currNode.properties },
          children: newChildren,
        },
      ];
    }

    // For other node types, convert to text node
    return [
      {
        type: "text",
        value: String(currNode.type),
      },
    ];
  }

  // Create a proper Root node with the compared children
  return {
    type: "root",
    children: compareNodes(previousTree, currentTree),
  } as Root;
}

function processDiff(currentContent: string, previousContent: string): string {
  const processor = unified().use(remarkParse).use(remarkGfm);

  // Parse both contents into ASTs
  const currentTree = toHast(processor.parse(currentContent));
  const previousTree = toHast(processor.parse(previousContent));

  if (!currentTree || !previousTree) {
    throw new Error("Failed to parse markdown content");
  }

  // Generate the diff
  const diffTree = generateDiff(previousTree, currentTree);

  console.log({ currentTree, previousTree, diffTree });
  // Convert the diff AST to HTML
  const html = toHtml(diffTree);

  return DOMPurify.sanitize(applyStyle(html));
}

const BodyContent = ({
  content,
  allBodies,
  version,
}: ContentSectionClientProps) => {
  const [expanded, setExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [diff] = useQueryState("diff", parseAsBoolean.withDefault(false));

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const collapsedHeight = viewportHeight * 0.25;

  const processedContent = useMemo(() => {
    if (diff && version > 0) {
      const previousContent = allBodies[version - 1];
      return processDiff(content, previousContent);
    }
    return markdownToHtml(content);
  }, [content, allBodies, version, diff]);

  return (
    <div className="relative pb-16">
      <div
        className={`relative transition-all duration-500 ease-in-out ${
          !expanded ? "" : "overflow-hidden"
        }`}
        style={{ maxHeight: !expanded ? "none" : `${collapsedHeight}px` }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: processedContent }}
          className={`prose prose-lg max-w-none`}
        />

        {expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold transition-colors hover:bg-gray-50"
        aria-label={
          expanded ? "Expand proposal content" : "Collapse proposal content"
        }
      >
        {expanded ? (
          <>
            <ArrowDown className="rounded-full border p-1" />
            Read Full Proposal
          </>
        ) : (
          <>
            <ArrowUp className="rounded-full border p-1" />
            <div className="flex flex-row items-center gap-2">
              Comments and Votes
              <ArrowDown className="rounded-full border p-1" />
            </div>
          </>
        )}
      </button>
    </div>
  );
};

export default BodyContent;
