import { DiscourseUser, Selectable } from '@proposalsapp/db-indexer';
import { formatDistanceToNowStrict } from 'date-fns';
import { Root } from 'hast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHast } from 'mdast-util-to-hast';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import {
  COLLAPSIBLE_STYLES,
  MARKDOWN_STYLES,
  QUOTE_STYLES_POST,
} from '@/lib/markdown_styles';
import {
  getDelegateByDiscourseUser,
  getDiscourseUser,
  getPostLikesCount,
} from '../../actions';
import { FeedReturnType, GroupReturnType } from '../../../../actions';
import { DiscourseAuthor } from '@/app/[daoSlug]/components/author-discourse';
import HeartIcon from '@/public/assets/web/heart.svg';
import SeenIcon from '@/public/assets/web/seen.svg';

export async function PostItem({
  item,
  group,
}: {
  item: FeedReturnType['posts'][0];
  group: GroupReturnType;
}) {
  if (!group) {
    return null;
  }

  const author = await getDiscourseUser(item.userId, item.daoDiscourseId);

  const likesCount = await getPostLikesCount(
    item.externalId,
    item.daoDiscourseId
  );

  const proposalIds = Array.from(new Set(group.proposals.map((p) => p.id)));
  const topicIds = Array.from(new Set(group.topics.map((t) => t.id)));

  const delegate = await getDelegateByDiscourseUser(
    item.userId,
    group.daoSlug,
    false,
    topicIds,
    proposalIds
  );

  const currentVotingPower =
    delegate?.delegatetovoter?.latestVotingPower?.votingPower;

  const processedContent = markdownToHtml(item.cooked ?? 'Unknown');
  const postAnchorId = `post-${item.postNumber}-${item.topicId}`;
  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.createdAt),
    {
      addSuffix: true,
    }
  );

  const updatedAt =
    item.updatedAt instanceof Date ? item.updatedAt : new Date(item.updatedAt);
  const relativeUpdateTime = formatDistanceToNowStrict(
    new Date(item.updatedAt),
    {
      addSuffix: true,
    }
  );

  const isPostDeleted = item.deleted;

  return (
    <div id={postAnchorId} className='w-full scroll-mt-36'>
      {isPostDeleted ? (
        // Show the full details/summary UI for deleted posts
        <details className='w-full'>
          <summary
            className='flex h-12 cursor-default list-none items-center justify-center
              border-neutral-400 text-neutral-500 [&::-webkit-details-marker]:hidden'
          >
            <div className='grow border-t border-neutral-300 dark:border-neutral-700'></div>
            <span
              className='relative bg-neutral-50 px-4 text-sm text-neutral-500 dark:bg-neutral-900
                dark:text-neutral-400'
            >
              Deleted Post
            </span>
            <div className='grow border-t border-neutral-300 dark:border-neutral-700'></div>
          </summary>
        </details>
      ) : (
        <PostContent
          author={author}
          ens={delegate?.delegatetovoter?.ens}
          relativeCreateTime={relativeCreateTime}
          relativeUpdateTime={relativeUpdateTime}
          updatedAt={updatedAt}
          likesCount={likesCount}
          processedContent={processedContent}
          contentLength={item.cooked?.length || 0}
          currentVotingPower={currentVotingPower}
          item={item}
        />
      )}
    </div>
  );
}

const PostContent = ({
  author,
  ens,
  relativeCreateTime,
  relativeUpdateTime,
  updatedAt,
  likesCount,
  processedContent,
  contentLength,
  item,
  currentVotingPower,
}: {
  author: Selectable<DiscourseUser> | undefined;
  ens: string | undefined;
  relativeCreateTime: string;
  relativeUpdateTime: string;
  updatedAt: Date;
  likesCount: number;
  processedContent: string;
  contentLength: number;
  item: FeedReturnType['posts'][0];
  currentVotingPower?: number;
}) => {
  const CONTENT_THRESHOLD = 400;

  // Helper function to find the next paragraph break
  const findNextParagraphBreak = (content: string): number => {
    const breakPatterns = ['</p>', '<br>', '\n\n'];

    // Find the first break point after the threshold
    for (const pattern of breakPatterns) {
      const index = content.indexOf(pattern, CONTENT_THRESHOLD);
      if (index !== -1) {
        return index + pattern.length;
      }
    }

    // If no break point is found, return the entire content length
    return content.length;
  };

  // Only find break point if we need to collapse
  const slicePoint = findNextParagraphBreak(processedContent);

  const shouldCollapse =
    contentLength > CONTENT_THRESHOLD &&
    processedContent.length > processedContent.slice(0, slicePoint).length;

  return (
    <>
      <div className='flex cursor-default flex-row justify-between select-none'>
        {author ? (
          <DiscourseAuthor
            username={author.username}
            ens={ens}
            avatar={author.avatarTemplate}
            currentVotingPower={currentVotingPower}
            eventVotingPower={null}
          />
        ) : null}

        <div
          className='dark:text-neutral-350 flex cursor-default flex-col items-end text-sm
            text-neutral-600 select-none'
        >
          <div className='flex flex-col items-end'>
            <div>
              posted <span className='font-bold'>{relativeCreateTime}</span>
            </div>
          </div>
          {item.createdAt.getTime() != updatedAt.getTime() && (
            <div>
              <span>edited {relativeUpdateTime}</span>
            </div>
          )}
        </div>
      </div>

      {shouldCollapse ? (
        <details className='group relative mt-6'>
          <summary className='cursor-pointer list-none [&::-webkit-details-marker]:hidden'>
            <div className='prose prose-lg relative max-w-none'>
              <div
                dangerouslySetInnerHTML={{
                  __html: processedContent.slice(0, slicePoint),
                }}
                className='group-open:hidden'
              />
              <div
                className='absolute right-0 bottom-0 left-0 h-36 bg-gradient-to-t from-neutral-50
                  to-transparent group-open:hidden dark:from-neutral-900'
              />
              <div className='relative my-4 flex items-end justify-end group-open:hidden'>
                <div className='absolute w-full border-t border-neutral-300 dark:border-neutral-700' />
                <span
                  className='relative flex flex-row gap-4 bg-neutral-200 px-4 text-sm text-neutral-600
                    dark:bg-neutral-600 dark:text-neutral-300'
                >
                  <div className='flex flex-row items-center gap-2 self-end justify-self-end'>
                    {likesCount > 0 ? (
                      <div className='flex items-center gap-1 text-sm'>
                        <span>{likesCount}</span>
                        <HeartIcon className='h-3 w-3 self-center' />
                      </div>
                    ) : null}

                    <div className='flex items-center gap-1 text-sm'>
                      <span>{item.reads}</span>
                      <SeenIcon className='h-3 w-3 self-center' />
                    </div>
                  </div>
                  <span> Read More</span>
                </span>
              </div>
            </div>
          </summary>
          <div className='w-full'>
            <div
              dangerouslySetInnerHTML={{ __html: processedContent }}
              className='prose prose-lg mt-4 max-w-none break-words text-ellipsis'
            />

            <div className='flex flex-row items-center gap-4 self-end justify-self-end'>
              <div className='ml-auto flex flex-row items-center gap-2'>
                {likesCount > 0 ? (
                  <div className='flex items-center gap-1 text-sm'>
                    <span>{likesCount}</span>
                    <HeartIcon className='h-3 w-3 self-center' />
                  </div>
                ) : null}

                <div className='flex items-center gap-1 text-sm'>
                  <span>{item.reads}</span>
                  <SeenIcon className='h-3 w-3 self-center' />
                </div>
              </div>
            </div>
          </div>
        </details>
      ) : (
        <div className='w-full'>
          <div
            dangerouslySetInnerHTML={{ __html: processedContent }}
            className='prose prose-lg mt-4 max-w-none break-words text-ellipsis'
          />

          <div className='flex flex-row items-center gap-4 self-end justify-self-end'>
            <div className='ml-auto flex flex-row items-center gap-2'>
              {likesCount > 0 ? (
                <div className='flex items-center gap-1 text-sm'>
                  <span>{likesCount}</span>
                  <HeartIcon className='h-3 w-3 self-center' />
                </div>
              ) : null}

              <div className='flex items-center gap-1 text-sm'>
                <span>{item.reads}</span>
                <SeenIcon className='h-3 w-3 self-center' />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export function PostItemLoading() {
  return (
    <div className='flex w-full animate-pulse flex-col gap-4'>
      <div className='flex items-center gap-4'>
        <div className='h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800'></div>
        <div className='flex flex-col space-y-2'>
          <div className='h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-800'></div>
          <div className='h-3 w-32 rounded bg-neutral-200 dark:bg-neutral-800'></div>
        </div>
      </div>
      <div className='flex flex-col space-y-2'>
        <div className='h-4 w-full rounded bg-neutral-200 dark:bg-neutral-800'></div>
        <div className='h-4 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800'></div>
        <div className='h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800'></div>
      </div>
      <div className='mt-2 flex justify-end'>
        <div className='h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800'></div>
      </div>
    </div>
  );
}

type MarkdownStyleKeys = keyof typeof MARKDOWN_STYLES;

// Process quotes after HTML conversion
function processQuotes(html: string): string {
  if (!html.includes('[quote="')) return html;

  function createQuoteHtml(
    username: string,
    postNumber: string,
    topicId: string,
    content: string
  ) {
    const formattedContent = content
      .split('\n\n')
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .map((paragraph) => `<p class="${MARKDOWN_STYLES.p}">${paragraph}</p>`)
      .join('\n');

    return `
      <div class="${QUOTE_STYLES_POST.wrapper}">
        <div class="${QUOTE_STYLES_POST.header}">
          <span>Quoted from&nbsp;</span>
          <span>${username}</span>
        </div>
        <div class="${QUOTE_STYLES_POST.content}">
          ${formattedContent}
        </div>
        <div class="${QUOTE_STYLES_POST.linkWrapper}">
          <a href="${postNumber === '1' ? '#' : `#post-${postNumber}-${topicId}`}"
             class="${QUOTE_STYLES_POST.link}">
            ${postNumber === '1' ? 'back to top ↑' : 'jump to post →'}
          </a>
        </div>
      </div>
    `;
  }

  // Split the content into segments (quotes and non-quotes)
  const segments = html.split(/(\[quote="[^"]*"[\s\S]*?\[\/quote\])/g);

  return segments
    .map((segment) => {
      if (segment.startsWith('[quote="')) {
        // Process quote
        const match = segment.match(
          /\[quote="([^,]+),\s*post:(\d+),\s*topic:(\d+)(?:,\s*full:\w+)?"\]([\s\S]*?)\[\/quote\]/
        );
        if (match) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_, username, postNumber, topicId, content] = match;
          return createQuoteHtml(username, postNumber, topicId, content);
        }
        return segment;
      } else {
        // Process non-quote content
        // Wrap any non-empty content in a paragraph if it's not already wrapped
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
      // @typescript-eslint/no-unused-vars
      (_, summary, content) => {
        wasProcessed = true;
        return createDetailsHtml(summary, content);
      }
    );
  }

  return processedHtml;
}

// Define interfaces
interface HastNode {
  type: string;
  tagName?: string;
  properties?: {
    className?: string;
    [key: string]: string | string[] | number | boolean | null | undefined;
  };
  children?: HastNode[];
  value?: string;
}

function applyStyleToNode(node: HastNode): void {
  if (!node || typeof node !== 'object') return;

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
      // Ensure the hast node is compatible with the expected type
      const rootNode: Root = {
        type: 'root',
        children: hast.type === 'root' ? hast.children : [hast],
      };

      // Apply styles to the root node
      applyStyleToNode(rootNode as HastNode);

      const html = unified()
        .use(rehypeStringify, {
          closeSelfClosing: true,
          allowDangerousHtml: true,
        })
        .stringify(rootNode);

      // Process quotes after HTML conversion
      return processDetails(processQuotes(html));
    } else {
      return '<div>Error processing content</div>';
    }
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    return '<div>Error processing content</div>';
  }
}
