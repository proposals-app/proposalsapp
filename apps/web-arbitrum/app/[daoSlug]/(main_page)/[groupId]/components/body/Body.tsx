import {
  cleanUpNodeMarkers,
  visualDomDiff,
} from '@proposalsapp/visual-dom-diff';
import { Diff, DIFF_EQUAL, diff_match_patch } from 'diff-match-patch';
import { Nodes } from 'hast';
import { toDom } from 'hast-util-to-dom';
import { JSDOM } from 'jsdom';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHast } from 'mdast-util-to-hast';
import { notFound } from 'next/navigation';
import { BodyType, GroupReturnType } from '../../actions';
import { BodyContent } from './BodyContent';
import { PostedTime } from './PostedTime';
import {
  COLLAPSIBLE_STYLES,
  MARKDOWN_STYLES,
  QUOTE_STYLES,
} from '@/lib/markdown_styles';
import Image from 'next/image';
import { Header } from '@/app/[daoSlug]/components/Header';

export default async function Body({
  group,
  version,
  diff,
  bodies,
}: {
  group: GroupReturnType;
  version: number;
  diff: boolean;
  bodies: BodyType[];
}) {
  if (!group) {
    notFound();
  }

  if (!bodies || bodies.length === 0) {
    return <div className='w-full p-4'>No bodies found.</div>;
  }

  // Replace the getBodies_cached call with the passed bodies
  const initialBody = bodies[0];
  const latestBody = bodies[bodies.length - 1];

  // Use the latest version if no specific version is provided
  const defaultVersion = bodies.length - 1;
  const currentVersion =
    typeof version === 'undefined' ? defaultVersion : version;
  const visibleBody = bodies[currentVersion];

  const processedContent =
    diff && currentVersion > 0
      ? processDiff(visibleBody.content, bodies[currentVersion - 1].content)
      : markdownToHtml(visibleBody.content);

  return (
    <div className='w-full'>
      <Header groupId={group.groupId} withBack={false} withHide={true} />

      <div className='flex w-full flex-col gap-6'>
        <h1 className='text-4xl font-bold text-neutral-700 dark:text-neutral-300'>
          {visibleBody.title}
        </h1>

        <div className='flex flex-col'>
          <div className='flex flex-row justify-between'>
            <AuthorInfo
              authorName={visibleBody.author_name}
              authorPicture={visibleBody.author_picture}
            />

            <div className='flex flex-col items-center gap-2'>
              <div className='flex flex-row gap-4'>
                <PostedTime
                  label='initially posted'
                  createdAt={initialBody.createdAt}
                />

                <PostedTime
                  label='latest revision'
                  createdAt={latestBody.createdAt}
                  border
                />
              </div>
            </div>
          </div>
        </div>

        <div className='relative'>
          <BodyContent processedContent={processedContent} />
        </div>
      </div>
    </div>
  );
}

export function BodyLoading() {
  return (
    <div className='w-full'>
      {/* Title Loading */}
      <div className='mb-8 h-12 w-3/4 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800'></div>

      {/* Author Info Loading */}
      <div className='mb-6 flex animate-pulse items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800'></div>
          <div className='space-y-2'>
            <div className='h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800'></div>
            <div className='h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800'></div>
          </div>
        </div>
        <div className='flex space-x-2'>
          <div className='space-y-2'>
            <div className='h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-800'></div>
            <div className='h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800'></div>
          </div>
          <div className='space-y-2'>
            <div className='h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-800'></div>
            <div className='h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800'></div>
          </div>
        </div>
      </div>

      {/* Content Loading */}
      <div className='space-y-4'>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className='h-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'
            style={{ width: `${Math.random() * 40 + 60}%` }}
          ></div>
        ))}
      </div>
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
  <div className='flex flex-row items-center gap-2'>
    <div
      className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2
        border-neutral-700 dark:border-neutral-300'
    >
      <Image
        src={authorPicture}
        alt={authorName}
        className='object-cover'
        fetchPriority='high'
        width={40}
        height={40}
      />
    </div>
    <div className='font-bold text-neutral-700 dark:text-neutral-200'>
      {authorName}
    </div>
  </div>
);

// Create a JSDOM instance for server-side DOM manipulation
export const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
export const serverDocument = dom.window.document;

// Helper function to get the appropriate document object
export const getDocument = () => {
  if (typeof window !== 'undefined') {
    return document;
  }
  return serverDocument;
};

function processQuotes(html: string): string {
  if (!html.includes('[quote="')) return html;

  // Helper function to create a quote HTML structure
  function createQuoteHtml(username: string, content: string) {
    return `
      <div class="${QUOTE_STYLES.wrapper}">
        <div class="${QUOTE_STYLES.header}">
          <span>Quoted from&nbsp;</span>
          <span>${username}</span>
        </div>
        <div class="${QUOTE_STYLES.content}">
          ${content.trim()}
        </div>
      </div>
    `;
  }

  let processedHtml = html;
  let wasProcessed = true;

  while (wasProcessed) {
    wasProcessed = false;

    // Process one level of quotes at a time, starting with the innermost
    processedHtml = processedHtml.replace(
      /\[quote="([^,]+),\s*post:(\d+),\s*topic:(\d+)(?:,\s*full:\w+)?"]((?!\[quote=)[\s\S]*?)\[\/quote\]/g,
      (_, username, _postNumber, _topicId, content) => {
        wasProcessed = true;
        return createQuoteHtml(username, content);
      }
    );
  }

  return processedHtml;
}

function processDetails(html: string): string {
  if (!html.includes('[details="')) return html;

  // Helper function to create a collapsible details HTML structure
  function createDetailsHtml(summary: string, content: string) {
    return `
      <details class="${COLLAPSIBLE_STYLES.details}">
        <summary class="${COLLAPSIBLE_STYLES.summary}">${summary}</summary>
        <div class="${COLLAPSIBLE_STYLES.content}">
          ${content.trim()}
        </div>
      </details>
    `;
  }

  let processedHtml = html;
  let wasProcessed = true;

  while (wasProcessed) {
    wasProcessed = false;

    // Process one level of details at a time
    processedHtml = processedHtml.replace(
      /\[details="([^"]+)"\]((?!\[details=)[\s\S]*?)\[\/details\]/g,
      (_, summary, content) => {
        wasProcessed = true;
        return createDetailsHtml(summary, content);
      }
    );
  }

  return processedHtml;
}

export function applyStyle(
  dom: Document | Element | Comment | DocumentFragment | DocumentType | Text
): string {
  const doc = getDocument();
  const container = doc.createElement('div');
  container.appendChild(dom.cloneNode(true));

  Object.entries(MARKDOWN_STYLES).forEach(([tag, className]) => {
    container.querySelectorAll(tag).forEach((element) => {
      element.className = `${element.className} ${className}`.trim();
    });
  });

  return container.innerHTML;
}

export function markdownToHtml(markdown: string): string {
  // Create custom implementation of toDom that uses the server document
  const customToDom = (node: Nodes) => {
    const doc = getDocument();
    return toDom(node, { document: doc });
  };

  const markdownDom = customToDom(toHast(fromMarkdown(markdown)));
  const html = applyStyle(markdownDom);

  // Process quotes and details after HTML conversion
  return processDetails(processQuotes(html));
}

export function processDiff(
  currentContent: string,
  previousContent: string
): string {
  const customToDom = (node: Nodes) => {
    const doc = getDocument();
    return toDom(node, { document: doc });
  };

  // Parse both contents into DOM
  const currentTree = customToDom(toHast(fromMarkdown(currentContent)));
  const previousTree = customToDom(toHast(fromMarkdown(previousContent)));

  if (!currentTree || !previousTree) {
    throw new Error('Failed to parse markdown content');
  }

  // Generate the diff
  const diffFragment = visualDomDiff(previousTree, currentTree, {
    addedClass: 'diff-added',
    removedClass: 'diff-deleted',
    modifiedClass: 'diff-modified',
    diffText: diffText_word,
  });

  const styledHtml = applyStyle(diffFragment);

  return styledHtml;
}

export function diffText_word(oldText: string, newText: string): Diff[] {
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
      lineArray[0] = '';

      function diff_linesToCharsMunge_(text: string) {
        let chars = '';
        // Walk the text, pulling out a substring for each word.
        // text.split(' ') would would temporarily double our memory footprint.
        // Modifying text would create many large strings to garbage collect.
        let lineStart = 0;
        let lineEnd = -1;
        // Keeping our own length variable is faster than looking it up.
        let lineArrayLength = lineArray.length;
        while (lineEnd < text.length - 1) {
          lineEnd = text.indexOf(' ', lineStart);
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

    const a = diff_linesToWords(text1, text2);
    const lineText1 = a.chars1;
    const lineText2 = a.chars2;
    const lineArray = a.lineArray;
    const diffs = dmp.diff_main(lineText1, lineText2);
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
