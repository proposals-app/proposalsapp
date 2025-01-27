import { DiscourseUser, Selectable } from '@proposalsapp/db';
import * as Avatar from '@radix-ui/react-avatar';
import * as Tooltip from '@radix-ui/react-tooltip';
import { format, formatDistanceToNowStrict, formatISO } from 'date-fns';
import { Root } from 'hast';
import { CheckCheck, HeartIcon } from 'lucide-react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHast } from 'mdast-util-to-hast';
import { Suspense } from 'react';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { CombinedFeedItem, PostFeedItem } from '../Feed';
import {
  COLLAPSIBLE_STYLES,
  MARKDOWN_STYLES,
  QUOTE_STYLES_POST,
} from '@/lib/markdown_styles';
import {
  getDiscourseUser_cached,
  getPostLikedUsers_cached,
  getPostLikesCount_cached,
} from '../actions';

const isPostItem = (item: CombinedFeedItem): item is PostFeedItem => {
  return item.type === 'post';
};

export async function PostItem({
  item,
}: {
  item: CombinedFeedItem;
  previousPostNumber?: number;
}) {
  if (!isPostItem(item)) {
    return null;
  }

  const author = await getDiscourseUser_cached(
    item.userId,
    item.daoDiscourseId
  );
  const likesCount = await getPostLikesCount_cached(
    item.externalId,
    item.daoDiscourseId
  );
  const likedUsers = await getPostLikedUsers_cached(
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
          <div className='grow border-t border-neutral-400 dark:border-neutral-600'></div>
          <span className='mx-4'>deleted post</span>
          <div className='grow border-t border-neutral-400 dark:border-neutral-600'></div>
        </div>
      ) : isPostDeleted ? (
        // Show the full details/summary UI for deleted posts
        <details className='w-full'>
          <summary
            className='flex h-12 cursor-pointer list-none items-center justify-center
              border-neutral-400 text-neutral-500 dark:border-neutral-600
              [&::-webkit-details-marker]:hidden'
          >
            <div className='grow border-t border-neutral-400 dark:border-neutral-600'></div>
            <span className='mx-4'>deleted post</span>
            <div className='grow border-t border-neutral-400 dark:border-neutral-600'></div>
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
    <div className='flex cursor-default flex-row justify-between select-none'>
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
        className='flex cursor-default flex-col items-end text-sm text-neutral-500 select-none
          dark:text-neutral-300'
      >
        <div className='flex flex-col items-end'>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div>
                posted <span className='font-bold'>{relativeCreateTime}</span>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content
              className='max-w-44 rounded border border-neutral-200 bg-white p-2 text-center text-sm
                text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-800
                dark:text-neutral-100'
              sideOffset={5}
            >
              {' '}
              <p>{utcTime}</p>
            </Tooltip.Content>
          </Tooltip.Root>
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
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div className='flex items-center gap-1 text-sm'>
                  <HeartIcon className='h-4 w-4' />
                  <span>{likesCount}</span>
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content
                className='max-w-44 rounded border border-neutral-200 bg-white p-2 text-center text-sm
                  text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-800
                  dark:text-neutral-100'
                sideOffset={5}
              >
                {' '}
                <p>
                  Liked by:{' '}
                  {likedUsers.length > 0 ? likedUsers.join(', ') : 'No one yet'}
                </p>
              </Tooltip.Content>
            </Tooltip.Root>
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
      <div class="${QUOTE_STYLES_POST.wrapper}">
        <div class="${QUOTE_STYLES_POST.header}">
          <span>Quoted from&nbsp;</span>
          <span>${username}</span>
        </div>
        <div class="${QUOTE_STYLES_POST.content}">
          ${content.trim()}
        </div>
        <div class="${QUOTE_STYLES_POST.linkWrapper}">
          <a href="${anchorHref}" class="${QUOTE_STYLES_POST.link}">
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
