"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import { toHast } from "mdast-util-to-hast";
import { Diff, DIFF_EQUAL, diff_match_patch } from "diff-match-patch";
import { toDom } from "hast-util-to-dom";
import { visualDomDiff } from "visual-dom-diff";
import { cleanUpNodeMarkers } from "visual-dom-diff/lib/util";
import { fromMarkdown } from "mdast-util-from-markdown";
import { sanitize } from "hast-util-sanitize";

interface ContentSectionClientProps {
  content: string;
  allBodies: Array<string>;
  version: number;
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
};

function applyStyle(
  dom: Document | Element | Comment | DocumentFragment | DocumentType | Text,
): string {
  const container = document.createElement("div");
  container.appendChild(dom.cloneNode(true));

  Object.entries(MARKDOWN_STYLES).forEach(([tag, className]) => {
    container.querySelectorAll(tag).forEach((element) => {
      element.className = `${element.className} ${className}`.trim();
    });
  });

  return container.innerHTML;
}

function markdownToHtml(markdown: string): string {
  const markdownDom = toDom(sanitize(toHast(fromMarkdown(markdown))));

  const styledHtml = applyStyle(markdownDom);

  return styledHtml;
}

function processDiff(currentContent: string, previousContent: string): string {
  // Parse both contents into DOM
  const currentTree = toDom(sanitize(toHast(fromMarkdown(currentContent))));
  const previousTree = toDom(sanitize(toHast(fromMarkdown(previousContent))));

  if (!currentTree || !previousTree) {
    throw new Error("Failed to parse markdown content");
  }

  // Generate the diff
  const diffFragment = visualDomDiff(previousTree, currentTree, {
    addedClass: "diff-added",
    removedClass: "diff-deleted",
    modifiedClass: "diff-modified",
    diffText: diffText_word,
  });

  const styledHtml = applyStyle(diffFragment);

  return styledHtml;
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

function diffText_word(oldText: string, newText: string): Diff[] {
  const dmp = new diff_match_patch();
  function pushAll<T>(array: T[], items: T[]): void {
    let destination = array.length;
    let source = 0;
    const length = items.length;

    while (source < length) {
      array[destination++] = items[source++];
    }
  }

  function diff_wordMode(text1: string, text2: string) {
    function diff_linesToWords(text1: string, text2: string) {
      const lineArray: string[] = []; // e.g. lineArray[4] == 'Hello\n'
      const lineHash: Map<string, number> = new Map(); // e.g. lineHash['Hello\n'] == 4

      // '\x00' is a valid character, but various debuggers don't like it.
      // So we'll insert a junk entry to avoid generating a null character.
      lineArray[0] = "";

      function diff_linesToCharsMunge_(text: string) {
        let chars = "";
        // Walk the text, pulling out a substring for each word.
        // text.split(' ') would would temporarily double our memory footprint.
        // Modifying text would create many large strings to garbage collect.
        let lineStart = 0;
        let lineEnd = -1;
        // Keeping our own length variable is faster than looking it up.
        let lineArrayLength = lineArray.length;
        while (lineEnd < text.length - 1) {
          lineEnd = text.indexOf(" ", lineStart);
          if (lineEnd == -1) {
            lineEnd = text.length - 1;
          }
          let line = text.substring(lineStart, lineEnd + 1);

          if (lineHash.has(line)) {
            chars += String.fromCharCode(lineHash.get(line)!);
          } else {
            if (lineArrayLength == maxLines) {
              // Bail out at 65535 because
              // String.fromCharCode(65536) == String.fromCharCode(0)
              line = text.substring(lineStart);
              lineEnd = text.length;
            }
            chars += String.fromCharCode(lineArrayLength);
            lineHash.set(line, lineArrayLength);
            lineArray[lineArrayLength++] = line;
          }
          lineStart = lineEnd + 1;
        }
        return chars;
      }

      // Allocate 2/3rds of the space for text1, the rest for text2.
      let maxLines = 40000;
      const chars1 = diff_linesToCharsMunge_(text1);
      maxLines = 65535;
      const chars2 = diff_linesToCharsMunge_(text2);
      return { chars1, chars2, lineArray };
    }

    var a = diff_linesToWords(text1, text2);
    var lineText1 = a.chars1;
    var lineText2 = a.chars2;
    var lineArray = a.lineArray;
    var diffs = dmp.diff_main(lineText1, lineText2);
    dmp.diff_charsToLines_(diffs, lineArray);

    return diffs;
  }

  const diff = diff_wordMode(oldText, newText);
  const result: Diff[] = [];
  const temp: Diff[] = [];

  cleanUpNodeMarkers(diff);

  // Execute `dmp.diff_cleanupSemantic` excluding equal node markers.
  for (let i = 0, l = diff.length; i < l; ++i) {
    const item = diff[i];

    if (item[0] === DIFF_EQUAL) {
      const text = item[1];
      const totalLength = text.length;
      const prefixLength = /^[^\uE000-\uF8FF]*/.exec(text)![0].length;

      if (prefixLength < totalLength) {
        const suffixLength = /[^\uE000-\uF8FF]*$/.exec(text)![0].length;

        if (prefixLength > 0) {
          temp.push([DIFF_EQUAL, text.substring(0, prefixLength)]);
        }

        dmp.diff_cleanupSemantic(temp);
        pushAll(result, temp);
        temp.length = 0;

        result.push([
          DIFF_EQUAL,
          text.substring(prefixLength, totalLength - suffixLength),
        ]);

        if (suffixLength > 0) {
          temp.push([DIFF_EQUAL, text.substring(totalLength - suffixLength)]);
        }
      } else {
        temp.push(item);
      }
    } else {
      temp.push(item);
    }
  }

  dmp.diff_cleanupSemantic(temp);
  pushAll(result, temp);
  temp.length = 0;

  dmp.diff_cleanupMerge(result);
  cleanUpNodeMarkers(result);
  return result;
}
