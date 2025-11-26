import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import {
  cleanUpNodeMarkers,
  visualDomDiff,
} from '@proposalsapp/visual-dom-diff';
import { DIFF_EQUAL, diff_match_patch, type Diff } from 'diff-match-patch';
import type { Nodes } from 'hast';
import { toDom } from 'hast-util-to-dom';
import { JSDOM } from 'jsdom';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHast } from 'mdast-util-to-hast';
import {
  COLLAPSIBLE_STYLES,
  MARKDOWN_STYLES,
  QUOTE_STYLES,
  QUOTE_STYLES_POST,
} from './markdown_styles';

/**
 * Escape HTML special characters to prevent XSS attacks.
 * This is used for user-provided content that gets inserted into HTML templates.
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

// Create a JSDOM instance for server-side DOM manipulation
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const serverDocument = dom.window.document;

// Helper function to get the appropriate document object
const getDocument = () => {
  if (typeof window !== 'undefined') {
    return document;
  }
  return serverDocument;
};

// Process quotes for body content
function processQuotesBody(html: string): string {
  if (!html.includes('[quote="')) return html;

  function createQuoteHtml(username: string, content: string) {
    // Escape username to prevent XSS - content is already sanitized HTML from rehype-sanitize
    const safeUsername = escapeHtml(username);
    return `
      <div class="${QUOTE_STYLES.wrapper}">
        <div class="${QUOTE_STYLES.header}">
          <span>Quoted from&nbsp;</span>
          <span>${safeUsername}</span>
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

// Process quotes for post content
function processQuotesPost(html: string): string {
  if (!html.includes('[quote="')) return html;

  function createQuoteHtml(
    username: string,
    postNumber: string,
    topicId: string,
    content: string
  ) {
    // Escape user-provided content to prevent XSS
    const safeUsername = escapeHtml(username);
    // postNumber and topicId are validated by regex to be digits only, but escape for safety
    const safePostNumber = escapeHtml(postNumber);
    const safeTopicId = escapeHtml(topicId);

    const formattedContent = content
      .split('\n\n')
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .map((paragraph) => `<p class="${MARKDOWN_STYLES.p}">${escapeHtml(paragraph)}</p>`)
      .join('\n');

    return `
      <div class="${QUOTE_STYLES_POST.wrapper}">
        <div class="${QUOTE_STYLES_POST.header}">
          <span>Quoted from&nbsp;</span>
          <span>${safeUsername}</span>
        </div>
        <div class="${QUOTE_STYLES_POST.content}">
          ${formattedContent}
        </div>
        <div class="${QUOTE_STYLES_POST.linkWrapper}">
          <a href="${safePostNumber === '1' ? '#body' : `#post-${safePostNumber}-${safeTopicId}`}"
             class="${QUOTE_STYLES_POST.link}">
            ${safePostNumber === '1' ? 'back to top ↑' : 'jump to post →'}
          </a>
        </div>
      </div>
    `;
  }

  const segments = html.split(/(\[quote="[^"]*"[\s\S]*?\[\/quote\])/g);

  return segments
    .map((segment) => {
      if (segment.startsWith('[quote="')) {
        const match = segment.match(
          /\[quote="([^,]+),\s*post:(\d+),\s*topic:(\d+)(?:,\s*full:\w+)?"\]([\s\S]*?)\[\/quote\]/
        );
        if (match) {
          const [, username, postNumber, topicId, content] = match;
          return createQuoteHtml(username, postNumber, topicId, content);
        }
        return segment;
      } else {
        return segment
          .split('\n\n')
          .map((paragraph) => paragraph.trim())
          .filter((paragraph) => paragraph.length > 0)
          .map((paragraph) => {
            if (!paragraph.startsWith('<p') && !paragraph.startsWith('<')) {
              return `<p class="${MARKDOWN_STYLES.p}">${paragraph}</p>`;
            }
            return paragraph;
          })
          .join('\n');
      }
    })
    .join('\n');
}

// Process collapsible details
function processDetails(html: string): string {
  if (!html.includes('[details="')) return html;

  function createDetailsHtml(summary: string, content: string) {
    // Escape summary to prevent XSS - content is already sanitized HTML from rehype-sanitize
    const safeSummary = escapeHtml(summary);
    return `
      <details class="${COLLAPSIBLE_STYLES.details}">
        <summary class="${COLLAPSIBLE_STYLES.summary}">${safeSummary}</summary>
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

// Apply styles to HTML elements
function applyStylesToHtml(html: string): string {
  // Apply styles by replacing HTML tags with styled versions
  let styledHtml = html;

  Object.entries(MARKDOWN_STYLES).forEach(([tag, className]) => {
    // Handle self-closing tags
    if (tag === 'img' || tag === 'hr') {
      const regex = new RegExp(`<${tag}([^>]*)>`, 'g');
      styledHtml = styledHtml.replace(regex, `<${tag}$1 class="${className}">`);
    } else {
      // Handle opening tags with potential existing attributes
      const regex = new RegExp(`<${tag}([^>]*)>`, 'g');
      styledHtml = styledHtml.replace(regex, (match, attributes) => {
        // Check if class attribute already exists
        const classMatch = attributes.match(/class=["']([^"']*)["']/);
        if (classMatch) {
          // Merge with existing class
          const existingClass = classMatch[1];
          const combinedClass = `${existingClass} ${className}`;
          return match.replace(
            /class=["'][^"']*["']/,
            `class="${combinedClass}"`
          );
        } else {
          // Add new class attribute
          return `<${tag}${attributes} class="${className}">`;
        }
      });
    }
  });

  return styledHtml;
}

// Wrap tables in responsive containers
function wrapTablesResponsive(html: string): string {
  return html
    .replace(/<table([^>]*)>/g, '<div class="overflow-x-auto my-4"><table$1>')
    .replace(/<\/table>/g, '</table></div>');
}

// Add target="_blank" and rel attributes to external links only
function addTargetBlankToLinks(html: string): string {
  return html.replace(
    /<a([^>]*href=["']([^"']+)["'][^>]*)>/g,
    (match, attributes, href) => {
      // Skip if target is already specified
      if (attributes.includes('target=')) {
        return match;
      }

      // Skip if rel is already specified and includes noopener
      if (attributes.includes('rel=') && attributes.includes('noopener')) {
        return match;
      }

      // Skip anchor links (internal page links starting with #)
      if (href.startsWith('#')) {
        return match;
      }

      // Add target="_blank" and rel="noopener noreferrer" to external links only
      return `<a${attributes} target="_blank" rel="noopener noreferrer">`;
    }
  );
}

// Main markdown to HTML converter
export function markdownToHtml(
  markdown: string,
  context: 'body' | 'post' = 'body'
): string {
  try {
    // Process markdown with full GFM support including tables
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm) // This includes table support
      // Convert to HAST allowing raw HTML, then sanitize
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, {
        ...defaultSchema,
        // Extend default schema minimally to allow common attributes/classes we add
        attributes: {
          ...defaultSchema.attributes,
          a: [
            ...(defaultSchema.attributes?.a || []),
            ['target'],
            ['rel'],
            ['className'],
          ],
          p: [...(defaultSchema.attributes?.p || []), ['className']],
          img: [
            ...(defaultSchema.attributes?.img || []),
            ['className'],
            ['loading'],
            ['decoding'],
          ],
          table: [...(defaultSchema.attributes?.table || []), ['className']],
          thead: [...(defaultSchema.attributes?.thead || []), ['className']],
          tbody: [...(defaultSchema.attributes?.tbody || []), ['className']],
          tr: [...(defaultSchema.attributes?.tr || []), ['className']],
          td: [
            ...(defaultSchema.attributes?.td || []),
            ['className', 'colspan'],
          ],
          th: [
            ...(defaultSchema.attributes?.th || []),
            ['className', 'colspan'],
          ],
          details: [
            ...(defaultSchema.attributes?.details || []),
            ['className'],
            ['open'],
          ],
          summary: [
            ...(defaultSchema.attributes?.summary || []),
            ['className'],
          ],
          div: [...(defaultSchema.attributes?.div || []), ['className', 'id']],
          span: [...(defaultSchema.attributes?.span || []), ['className']],
        },
        clobberPrefix: 'md-',
      })
      .use(rehypeStringify);

    let html = processor.processSync(markdown).toString();

    // Apply our custom styles
    html = applyStylesToHtml(html);

    // Process custom discourse syntax
    html = processDetails(html);
    html =
      context === 'post' ? processQuotesPost(html) : processQuotesBody(html);

    // Wrap tables for responsive design
    html = wrapTablesResponsive(html);

    // Add target="_blank" to all links
    html = addTargetBlankToLinks(html);

    return html;
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    return '<div class="text-red-500">Error processing content</div>';
  }
}

// Diff processing for markdown content
export function markdownDiff(
  currentContent: string,
  previousContent: string
): string {
  try {
    const customToDom = (node: Nodes) => {
      const doc = getDocument();
      return toDom(node, { document: doc });
    };

    // Parse both contents into DOM with full GFM support
    const currentTree = customToDom(
      toHast(
        fromMarkdown(currentContent, {
          extensions: [gfm()],
          mdastExtensions: [gfmFromMarkdown()],
        })
      )
    );
    const previousTree = customToDom(
      toHast(
        fromMarkdown(previousContent, {
          extensions: [gfm()],
          mdastExtensions: [gfmFromMarkdown()],
        })
      )
    );

    if (!currentTree || !previousTree) {
      throw new Error('Failed to parse markdown content for diff');
    }

    // Generate the diff
    const diffFragment = visualDomDiff(previousTree, currentTree, {
      addedClass: 'diff-added',
      removedClass: 'diff-deleted',
      modifiedClass: 'diff-modified',
      diffText: diffTextWord,
    });

    // Apply styles to the diff result
    return applyStyleToDOM(diffFragment);
  } catch (error) {
    console.error('Error processing markdown diff:', error);
    return markdownToHtml(currentContent, 'body');
  }
}

// Apply styles to DOM elements (for diff processing)
function applyStyleToDOM(
  dom: Document | Element | Comment | DocumentFragment | DocumentType | Text
): string {
  const doc = getDocument();
  const container = doc.createElement('div');
  if (dom.hasChildNodes()) container.appendChild(dom.cloneNode(true));

  Object.entries(MARKDOWN_STYLES).forEach(([tag, className]) => {
    container.querySelectorAll(tag).forEach((element) => {
      // Properly merge classes instead of just concatenating
      const existingClasses = element.className.trim();
      if (existingClasses) {
        element.className = `${existingClasses} ${className}`;
      } else {
        element.className = className;
      }
    });
  });

  // Wrap tables in responsive containers
  container.querySelectorAll('table').forEach((table) => {
    const wrapper = doc.createElement('div');
    wrapper.className = 'overflow-x-auto my-4';
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    // Remove margin from table since wrapper handles it
    table.classList.remove('my-4');
  });

  let result = container.innerHTML;

  // Add target="_blank" to external links only
  result = addTargetBlankToLinks(result);

  return result;
}

// Word-level diff for text content
export function diffTextWord(oldText: string, newText: string): Diff[] {
  const dmp = new diff_match_patch();

  function pushAll<T>(array: T[], items: T[]): void {
    let destination = array.length;
    let source = 0;
    const length = items.length;

    while (source < length) {
      array[destination++] = items[source++];
    }
  }

  function diffWordMode(text1: string, text2: string) {
    function diffLinesToWords(text1: string, text2: string) {
      const lineArray: string[] = [];
      const lineHash: Map<string, number> = new Map();

      lineArray[0] = '';

      function diffLinesToCharsMunge_(text: string) {
        let chars = '';
        let lineStart = 0;
        let lineEnd = -1;
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

      let maxLines = 40000;
      const chars1 = diffLinesToCharsMunge_(text1);
      maxLines = 65535;
      const chars2 = diffLinesToCharsMunge_(text2);
      return { chars1, chars2, lineArray };
    }

    const a = diffLinesToWords(text1, text2);
    const lineText1 = a.chars1;
    const lineText2 = a.chars2;
    const lineArray = a.lineArray;
    const diffs = dmp.diff_main(lineText1, lineText2);
    dmp.diff_charsToLines_(diffs, lineArray);

    return diffs;
  }

  const diff = diffWordMode(oldText, newText);
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

// Main processing function that handles both regular and diff modes
export function processMarkdown(
  visibleBodyContent: string,
  previousBodyContent: string | null,
  diffEnabled: boolean,
  currentVersion: number,
  context: 'body' | 'post' = 'body'
): string {
  if (diffEnabled && currentVersion > 0 && previousBodyContent) {
    return markdownDiff(visibleBodyContent, previousBodyContent);
  } else {
    return markdownToHtml(visibleBodyContent, context);
  }
}

// Legacy export for backward compatibility
export { markdownToHtml as default };
