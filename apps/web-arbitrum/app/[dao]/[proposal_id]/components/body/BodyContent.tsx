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
import { diff_match_patch } from "diff-match-patch";

interface ContentSectionClientProps {
  content: string;
  allBodies: Array<string>;
  version: number;
}

// Security configurations
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
];

// Common styles to be applied via DOMPurify
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

// Convert markdown to HTML
const markdownToHtml = (markdownContent: string): string => {
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify);

    return String(processor.processSync(markdownContent));
  } catch (error) {
    console.error("Error converting Markdown to HTML:", error);
    return markdownContent;
  }
};

// Apply common styles to HTML elements
const applyCommonStyles = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  Object.entries(COMMON_STYLES).forEach(([tag, className]) => {
    doc.querySelectorAll(tag).forEach((element) => {
      if (tag == "a") element.setAttribute("rel", "noopener noreferrer");
      element.className = `${element.className} ${className}`.trim();
      if (tag == "a") element.setAttribute("target", "_blank");
    });
  });

  return doc.body.innerHTML;
};

// Normalize content to styled HTML
const normalizeContent = (content: string): string => {
  let html = markdownToHtml(content);
  html = applyCommonStyles(html);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
};

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

  // Process content based on diff mode
  const processedContent = useMemo(() => {
    if (!diff) {
      return normalizeContent(content);
    }

    const previousContent = version > 0 ? allBodies[version - 1] : null;
    if (!previousContent) return normalizeContent(content);

    // Normalize both contents for diffing
    const normalizedPrevious = normalizeContent(previousContent);
    const normalizedCurrent = normalizeContent(content);

    const diffs = diff_lineMode(normalizedPrevious, normalizedCurrent);

    // Generate HTML with diff highlights
    const diffHtml = diffs
      .map(([op, text]) => {
        switch (op) {
          case 0:
            return `<span>${text}</span>`;
          case 1:
            return `<span class="diff-add !border-2">${text}</span>`;
          case -1:
            return `<span class="diff-delete !border-2">${text}</span>`;
          default:
            return "";
        }
      })
      .join("");

    return DOMPurify.sanitize(diffHtml, { ALLOWED_TAGS, ALLOWED_ATTR });
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
          className="prose prose-lg max-w-none [&_.diff-add]:!bg-emerald-200 [&_.diff-delete]:!bg-red-200"
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

function diff_standardMode(text1: string, text2: string) {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(text1, text2);
  dmp.diff_cleanupSemanticLossless(diffs);
  return diffs;
}

function diff_lineMode(text1: string, text2: string) {
  var dmp = new diff_match_patch();
  var a = dmp.diff_linesToChars_(text1, text2);
  var lineText1 = a.chars1;
  var lineText2 = a.chars2;
  var lineArray = a.lineArray;
  var diffs = dmp.diff_main(lineText1, lineText2, false);
  dmp.diff_charsToLines_(diffs, lineArray);
  dmp.diff_cleanupSemanticLossless(diffs);
  return diffs;
}

function diff_wordMode(text1: string, text2: string) {
  function diff_linesToWords(text1: string, text2: string) {
    var lineArray: string[] = []; // e.g. lineArray[4] == 'Hello\n'
    var lineHash: { [key: string]: number } = {}; // e.g. lineHash['Hello\n'] == 4

    // '\x00' is a valid character, but various debuggers don't like it.
    // So we'll insert a junk entry to avoid generating a null character.
    lineArray[0] = "";

    /**
     * Split a text into an array of strings.  Reduce the texts to a string of
     * hashes where each Unicode character represents one line.
     * Modifies linearray and linehash through being a closure.
     * @param {string} text String to encode.
     * @return {string} Encoded string.
     * @private
     */
    function diff_linesToCharsMunge_(text: string) {
      var chars = "";
      // Walk the text, pulling out a substring for each line.
      // text.split('\n') would would temporarily double our memory footprint.
      // Modifying text would create many large strings to garbage collect.
      var lineStart = 0;
      var lineEnd = -1;
      // Keeping our own length variable is faster than looking it up.
      var lineArrayLength = lineArray.length;
      while (lineEnd < text.length - 1) {
        lineEnd = text.indexOf(" ", lineStart);
        if (lineEnd == -1) {
          lineEnd = text.length - 1;
        }
        var line = text.substring(lineStart, lineEnd + 1);

        if (Object.prototype.hasOwnProperty.call(lineHash, line)) {
          chars += String.fromCharCode(lineHash[line]);
        } else {
          if (lineArrayLength == maxLines) {
            // Bail out at 65535 because
            // String.fromCharCode(65536) == String.fromCharCode(0)
            line = text.substring(lineStart);
            lineEnd = text.length;
          }
          chars += String.fromCharCode(lineArrayLength);
          lineHash[line] = lineArrayLength;
          lineArray[lineArrayLength++] = line;
        }
        lineStart = lineEnd + 1;
      }
      return chars;
    }
    // Allocate 2/3rds of the space for text1, the rest for text2.
    var maxLines = 40000;
    var chars1 = diff_linesToCharsMunge_(text1);
    maxLines = 65535;
    var chars2 = diff_linesToCharsMunge_(text2);

    return { chars1: chars1, chars2: chars2, lineArray: lineArray };
  }

  var dmp = new diff_match_patch();
  var a = diff_linesToWords(text1, text2);
  var lineText1 = a.chars1;
  var lineText2 = a.chars2;
  var lineArray = a.lineArray;
  var diffs = dmp.diff_main(lineText1, lineText2, false);
  dmp.diff_charsToLines_(diffs, lineArray);
  dmp.diff_cleanupSemanticLossless(diffs);
  return diffs;
}
