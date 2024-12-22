import {
  cleanUpNodeMarkers,
  visualDomDiff,
} from "@proposalsapp/visual-dom-diff";
import { diff_match_patch, DIFF_EQUAL, Diff } from "diff-match-patch";
import { toDom } from "hast-util-to-dom";
import { toHast } from "mdast-util-to-hast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { JSDOM } from "jsdom";

// Create a JSDOM instance for server-side DOM manipulation
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const serverDocument = dom.window.document;

// Helper function to get the appropriate document object
const getDocument = () => {
  if (typeof window !== "undefined") {
    return document;
  }
  return serverDocument;
};

const COLLAPSED_HEIGHT = "25rem";

export async function BodyContent({
  content,
  allBodies,
  version,
  diff,
  expanded,
}: {
  content: string;
  allBodies: Array<string>;
  version: number;
  diff: boolean;
  expanded: boolean;
}) {
  // Process the content based on whether diff is enabled
  const processedContent =
    diff && version > 0
      ? processDiff(content, allBodies[version - 1])
      : markdownToHtml(content);

  return (
    <div className="relative pb-16">
      <div
        className={`relative transition-all duration-500 ease-in-out ${
          expanded ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{
          maxHeight: expanded ? "none" : COLLAPSED_HEIGHT,
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: processedContent }}
          className="diff-content prose prose-lg max-w-none"
        />

        {!expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

export default BodyContent;

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
  const doc = getDocument();
  const container = doc.createElement("div");
  container.appendChild(dom.cloneNode(true));

  Object.entries(MARKDOWN_STYLES).forEach(([tag, className]) => {
    container.querySelectorAll(tag).forEach((element) => {
      element.className = `${element.className} ${className}`.trim();
    });
  });

  return container.innerHTML;
}

function markdownToHtml(markdown: string): string {
  // Create custom implementation of toDom that uses the server document
  const customToDom = (node: any) => {
    const doc = getDocument();
    return toDom(node, { document: doc });
  };

  const markdownDom = customToDom(toHast(fromMarkdown(markdown)));
  return applyStyle(markdownDom);
}

function processDiff(currentContent: string, previousContent: string): string {
  const customToDom = (node: any) => {
    const doc = getDocument();
    return toDom(node, { document: doc });
  };

  // Parse both contents into DOM
  const currentTree = customToDom(toHast(fromMarkdown(currentContent)));
  const previousTree = customToDom(toHast(fromMarkdown(previousContent)));

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
