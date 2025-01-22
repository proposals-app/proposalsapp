import { DiscourseUser, Selectable } from '@proposalsapp/db';
import * as Avatar from '@radix-ui/react-avatar';
import * as Tooltip from '@radix-ui/react-tooltip';
import { format, formatDistanceToNowStrict, formatISO } from 'date-fns';
import { Root } from 'hast';
import { CheckCheck, HeartIcon } from 'lucide-react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHast } from 'mdast-util-to-hast';
import { unstable_cache } from 'next/cache';
import { Suspense } from 'react';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import {
  getDiscourseUser,
  getPostLikedUsers,
  getPostLikesCount,
} from '../actions';
import { CombinedFeedItem, PostFeedItem } from '../Feed';

const getDiscourseUserCached = unstable_cache(
  async (userId: number, daoDiscourseId: string) => {
    return await getDiscourseUser(userId, daoDiscourseId);
  },
  ['discourse-user'],
  { revalidate: 60 * 5, tags: ['discourse-user'] }
);

const getPostLikesCountCached = unstable_cache(
  async (externalPostId: number, daoDiscourseId: string) => {
    return await getPostLikesCount(externalPostId, daoDiscourseId);
  },
  ['post-likes-count'],
  { revalidate: 60 * 5, tags: ['post-likes'] }
);

const getPostLikedUsersCached = unstable_cache(
  async (externalPostId: number, daoDiscourseId: string) => {
    return await getPostLikedUsers(externalPostId, daoDiscourseId);
  },
  ['post-liked-users'],
  { revalidate: 60 * 5, tags: ['post-liked-users'] }
);

const isPostItem = (item: CombinedFeedItem): item is PostFeedItem => {
  return item.type === 'post';
};

export async function PostItem({
  item,
  previousPostNumber,
}: {
  item: CombinedFeedItem;
  previousPostNumber?: number;
}) {
  if (!isPostItem(item)) {
    return null;
  }

  const author = await getDiscourseUserCached(item.userId, item.daoDiscourseId);
  const likesCount = await getPostLikesCountCached(
    item.externalId,
    item.daoDiscourseId
  );
  const likedUsers = await getPostLikedUsersCached(
    item.externalId,
    item.daoDiscourseId
  );

  const processedContent = markdownToHtml(item.cooked);
  const postAnchorId = `post-${item.postNumber}-${item.topicId}`;
  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.timestamp),
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
  const utcTime = format(
    formatISO(item.timestamp),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'"
  );

  const isPostDeleted = item.deleted;

  return (
    <div id={postAnchorId} className='w-full scroll-mt-36'>
      {item.id.includes('placeholder') ? (
        // Show just the "deleted post" summary
        <div
          className='flex h-12 w-full items-center justify-center border-neutral-400 text-neutral-500
            dark:border-neutral-600'
        >
          <div className='flex-grow border-t border-neutral-400 dark:border-neutral-600'></div>
          <span className='mx-4'>deleted post</span>
          <div className='flex-grow border-t border-neutral-400 dark:border-neutral-600'></div>
        </div>
      ) : isPostDeleted ? (
        // Show the full details/summary UI for deleted posts
        <details className='w-full'>
          <summary
            className='flex h-12 cursor-pointer list-none items-center justify-center
              border-neutral-400 text-neutral-500 dark:border-neutral-600
              [&::-webkit-details-marker]:hidden'
          >
            <div className='flex-grow border-t border-neutral-400 dark:border-neutral-600'></div>
            <span className='mx-4'>deleted post</span>
            <div className='flex-grow border-t border-neutral-400 dark:border-neutral-600'></div>
          </summary>
          <div className='p-4'>
            {item.id != 'placeholder' && (
              <PostContent
                author={author}
                relativeCreateTime={relativeCreateTime}
                utcTime={utcTime}
                relativeUpdateTime={relativeUpdateTime}
                updatedAt={updatedAt}
                likesCount={likesCount}
                likedUsers={likedUsers}
                processedContent={processedContent}
                item={item}
              />
            )}
          </div>
        </details>
      ) : (
        <div className='p-4'>
          <PostContent
            author={author}
            relativeCreateTime={relativeCreateTime}
            utcTime={utcTime}
            relativeUpdateTime={relativeUpdateTime}
            updatedAt={updatedAt}
            likesCount={likesCount}
            likedUsers={likedUsers}
            processedContent={processedContent}
            item={item}
          />
        </div>
      )}
    </div>
  );
}

const PostContent = ({
  author,
  relativeCreateTime,
  utcTime,
  relativeUpdateTime,
  updatedAt,
  likesCount,
  likedUsers,
  processedContent,
  item,
}: {
  author: Selectable<DiscourseUser> | undefined;
  relativeCreateTime: string;
  utcTime: string;
  relativeUpdateTime: string;
  updatedAt: Date;
  likesCount: number;
  likedUsers: string[];
  processedContent: string;
  item: PostFeedItem;
}) => (
  <>
    <div className='flex cursor-default select-none flex-row justify-between'>
      {author && (
        <Suspense>
          <AuthorInfo
            authorName={
              author.name && author.name.length ? author.name : author.username
            }
            authorPicture={author.avatarTemplate}
          />
        </Suspense>
      )}
      <div
        className='flex cursor-default select-none flex-col items-end text-sm text-neutral-500
          dark:text-neutral-300'
      >
        <div className='flex flex-col items-end'>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div>
                  posted <span className='font-bold'>{relativeCreateTime}</span>
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content className='rounded p-2'>
                <p>{utcTime}</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        {item.timestamp.getTime() != updatedAt.getTime() && (
          <div>
            <span>edited {relativeUpdateTime}</span>
          </div>
        )}

        <div className='flex flex-row items-center gap-4'>
          <div className='flex items-center gap-1 text-sm'>
            <CheckCheck className='h-4 w-4' />
            <span>{item.reads}</span>
          </div>
          {likesCount > 0 ? (
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div className='flex items-center gap-1 text-sm'>
                    <HeartIcon className='h-4 w-4' />
                    <span>{likesCount}</span>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content className='max-w-32 rounded border bg-white p-2'>
                  <p>
                    Liked by:{' '}
                    {likedUsers.length > 0
                      ? likedUsers.join(', ')
                      : 'No one yet'}
                  </p>
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          ) : (
            <div className='flex items-center gap-1 text-sm'>
              <HeartIcon className='h-4 w-4' />
              <span>{likesCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>

    <div
      dangerouslySetInnerHTML={{ __html: processedContent }}
      className='prose prose-lg mt-4 max-w-none'
    />
  </>
);

const AuthorInfo = ({
  authorName,
  authorPicture,
}: {
  authorName: string;
  authorPicture: string;
}) => (
  <div className='flex flex-row items-center gap-2'>
    <Avatar.Root className='flex h-10 w-10 items-center justify-center rounded-full'>
      <Avatar.Image src={authorPicture} className='w-full rounded-full' />
      <Avatar.Fallback>{authorName.slice(0, 2)}</Avatar.Fallback>
    </Avatar.Root>
    <div className='font-bold text-neutral-700 dark:text-neutral-200'>
      {authorName}
    </div>
  </div>
);

// Quote card styles
const QUOTE_STYLES = {
  wrapper: 'my-4 border-l-2 p-4',
  header: 'flex text-sm mb-2 font-bold',
  content: '',
  linkWrapper: 'w-full flex justify-end mt-2 cursor-default select-none',
  link: 'hover:underline text-sm font-bold no-underline',
} as const;

const COLLAPSIBLE_STYLES = {
  details:
    'my-4 border rounded-lg overflow-hidden text-neutral-700 dark:text-neutral-200',
  summary:
    'p-4 cursor-pointer font-bold text-neutral-700 dark:text-neutral-200',
  content: 'p-4 text-neutral-700 dark:text-neutral-200',
} as const;

const MARKDOWN_STYLES = {
  h1: 'mb-4 mt-6 text-2xl font-bold text-neutral-700 dark:text-neutral-200',
  h2: 'mb-3 mt-5 text-xl font-bold text-neutral-700 dark:text-neutral-200',
  h3: 'mb-2 mt-4 text-lg font-bold text-neutral-700 dark:text-neutral-200',
  p: 'mb-4 leading-relaxed text-neutral-700 dark:text-neutral-200',
  ul: 'mb-4 list-disc space-y-2 pl-6 text-neutral-700 dark:text-neutral-200',
  ol: 'mb-4 list-decimal space-y-2 pl-6 text-neutral-700 dark:text-neutral-200',
  li: 'leading-relaxed text-neutral-700 dark:text-neutral-200',
  strong: 'font-bold text-neutral-700 dark:text-neutral-200',
  a: 'underline text-neutral-700 dark:text-neutral-200',
  blockquote: 'border-l-4 pl-4 italic text-neutral-700 dark:text-neutral-200',
  table:
    'min-w-full border-collapse border my-4 text-neutral-700 dark:text-neutral-200',
  th: 'border p-2 text-left text-neutral-700 dark:text-neutral-200',
  td: 'border p-2 text-neutral-700 dark:text-neutral-200',
  img: 'my-4 h-auto max-w-full text-neutral-700 dark:text-neutral-200',
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
    content: string
  ) {
    const anchorHref =
      postNumber === '1' ? '#' : `#post-${postNumber}-${topicId}`;
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
                    ${postNumber === '1' ? 'back to top ↑' : 'jump to post →'}
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
