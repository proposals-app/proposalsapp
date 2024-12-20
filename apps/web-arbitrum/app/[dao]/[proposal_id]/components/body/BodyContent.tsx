"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Root } from "mdast";
import { toString } from "mdast-util-to-string";

interface ContentSectionClientProps {
  content: string;
  allBodies: Array<string>;
  version: number;
}

// Security configurations remain the same
const ALLOWED_TAGS = [
  "span",
  "del",
  "ins",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "li",
  "ol",
  "strong",
  "em",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "img",
  "br",
  "code",
  "pre",
  "blockquote",
  "hr",
];

const ALLOWED_ATTR = [
  "href",
  "src",
  "class",
  "style",
  "alt",
  "title",
  "target",
  "rel",
  "id",
  "name",
  "data-diff-type",
];

// Common styles remain the same
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

function applyCommonStyles(html: string): string {
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

function processMarkdownDiffHtmlFirst(
  currentContent: string,
  previousContent: string,
): string {
  const currentHtml = markdownToHtml(currentContent);
  const previousHtml = markdownToHtml(previousContent);

  const currentDiv = document.createElement("div");
  const previousDiv = document.createElement("div");
  currentDiv.innerHTML = currentHtml;
  previousDiv.innerHTML = previousHtml;

  let resultHtml = "";
  const currentBlocks = Array.from(currentDiv.children);
  const previousBlocks = Array.from(previousDiv.children);
  const maxBlocks = Math.max(currentBlocks.length, previousBlocks.length);

  for (let i = 0; i < maxBlocks; i++) {
    const currentBlock = currentBlocks[i];
    const previousBlock = previousBlocks[i];

    if (!previousBlock && currentBlock) {
      resultHtml += `<div class="diff-add">${currentBlock.outerHTML}</div>`;
    } else if (!currentBlock && previousBlock) {
      resultHtml += `<div class="diff-delete">${previousBlock.outerHTML}</div>`;
    } else if (currentBlock && previousBlock) {
      if (currentBlock.tagName === previousBlock.tagName) {
        if (currentBlock.innerHTML.trim() === previousBlock.innerHTML.trim()) {
          resultHtml += currentBlock.outerHTML;
        } else {
          const comparedContent = compareSentences(
            previousBlock.innerHTML,
            currentBlock.innerHTML,
          );
          resultHtml += `<${currentBlock.tagName.toLowerCase()}>${comparedContent}</${currentBlock.tagName.toLowerCase()}>`;
        }
      } else {
        resultHtml += `<div class="diff-modified">${currentBlock.outerHTML}</div>`;
      }
    }
  }

  return resultHtml;
}

// Approach 1: HTML-first diffing
function splitIntoSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function compareSentences(oldText: string, newText: string): string {
  const oldSentences = splitIntoSentences(oldText);
  const newSentences = splitIntoSentences(newText);

  let result = "";
  const maxLen = Math.max(oldSentences.length, newSentences.length);

  for (let i = 0; i < maxLen; i++) {
    const oldSentence = oldSentences[i] || "";
    const newSentence = newSentences[i] || "";

    if (!oldSentence) {
      result += `<span class="diff-add">${newSentence}</span>`;
    } else if (!newSentence) {
      result += `<span class="diff-delete">${oldSentence}</span>`;
    } else if (oldSentence.trim() !== newSentence.trim()) {
      result += `<span class="diff-modified">${newSentence}</span>`;
    } else {
      result += newSentence;
    }
  }

  return result;
}

// Approach 2: Markdown AST diffing
interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: any;
  [key: string]: any;
}

function compareMarkdownASTs(
  oldAst: MarkdownNode,
  newAst: MarkdownNode,
): MarkdownNode {
  if (oldAst.type !== newAst.type) {
    return {
      ...newAst,
      diffType: "modified",
    };
  }

  if (oldAst.value !== newAst.value) {
    return {
      ...newAst,
      diffType: oldAst.value ? "modified" : "added",
    };
  }

  if (oldAst.children && newAst.children) {
    const maxLength = Math.max(oldAst.children.length, newAst.children.length);
    const diffChildren = [];

    for (let i = 0; i < maxLength; i++) {
      const oldChild = oldAst.children[i];
      const newChild = newAst.children[i];

      if (!oldChild) {
        diffChildren.push({ ...newChild, diffType: "added" });
      } else if (!newChild) {
        diffChildren.push({ ...oldChild, diffType: "deleted" });
      } else {
        diffChildren.push(compareMarkdownASTs(oldChild, newChild));
      }
    }

    return {
      ...newAst,
      children: diffChildren,
    };
  }

  return newAst;
}

function astToHtml(ast: MarkdownNode): string {
  let className = "";
  if (ast.diffType === "added") className = "diff-add";
  if (ast.diffType === "deleted") className = "diff-delete";
  if (ast.diffType === "modified") className = "diff-modified";

  if (ast.value) {
    return className
      ? `<span class="${className}">${ast.value}</span>`
      : ast.value;
  }

  let innerHTML = "";
  if (ast.children) {
    innerHTML = ast.children.map((child) => astToHtml(child)).join("");
  }

  if (ast.type === "root") return innerHTML;

  const tag = ast.type === "paragraph" ? "p" : ast.type;
  return className
    ? `<${tag} class="${className}">${innerHTML}</${tag}>`
    : `<${tag}>${innerHTML}</${tag}>`;
}

// Unified processor setup
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

function markdownToHtml(markdownContent: string): string {
  try {
    return String(processor.processSync(markdownContent));
  } catch (error) {
    console.error("Error converting Markdown to HTML:", error);
    return markdownContent;
  }
}

function processMarkdownDiffAstFirst(
  currentContent: string,
  previousContent: string,
): string {
  const currentAst = processor.parse(currentContent) as unknown as MarkdownNode;
  const previousAst = processor.parse(
    previousContent,
  ) as unknown as MarkdownNode;

  const diffAst = compareMarkdownASTs(previousAst, currentAst);
  return astToHtml(diffAst);
}

const BodyContent = ({
  content,
  allBodies,
  version,
}: ContentSectionClientProps) => {
  const [expanded, setExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [diff] = useQueryState("diff", parseAsBoolean.withDefault(false));
  const [astDiff] = useQueryState("astDiff", parseAsBoolean.withDefault(false));

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const collapsedHeight = viewportHeight * 0.25;

  const processedContent = useMemo(() => {
    let html;
    if (diff && version > 0) {
      const previousContent = allBodies[version - 1];
      html = astDiff
        ? processMarkdownDiffAstFirst(content, previousContent)
        : processMarkdownDiffHtmlFirst(content, previousContent);
    } else {
      html = markdownToHtml(content);
    }

    html = applyCommonStyles(html);
    return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
  }, [content, allBodies, version, diff, astDiff]);

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
          className={`prose prose-lg max-w-none [&_.diff-add]:!bg-emerald-200 [&_.diff-delete]:!bg-red-200`}
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
