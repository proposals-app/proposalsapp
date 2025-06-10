import { notFound } from 'next/navigation';
import type { BodyVersionType, GroupReturnType } from '../../actions';
import { BodyContent } from './body-content';
import { processMarkdown } from '@/lib/markdown-converter';
import Image from 'next/image';

export function Body({
  group,
  diff,
  bodyVersions,
  currentVersion,
}: {
  group: GroupReturnType;
  diff: boolean;
  bodyVersions: BodyVersionType[];
  currentVersion: number;
}) {
  if (!group) {
    notFound();
  }

  if (!bodyVersions || bodyVersions.length === 0) {
    return <div className='w-full'>No bodies found.</div>;
  }

  const visibleBody = bodyVersions[currentVersion];
  const previousBody =
    diff && currentVersion > 0 ? bodyVersions[currentVersion - 1] : null;

  const processedContent = processMarkdown(
    visibleBody.content,
    previousBody?.content || null,
    diff,
    currentVersion,
    'body'
  );

  return (
    <div className='relative'>
      <BodyContent processedContent={processedContent} />
    </div>
  );
}

function BodyLoadingContent() {
  return (
    <div className='relative overflow-hidden'>
      <div
        className='prose prose-lg max-w-none overflow-hidden p-2 sm:p-6'
        style={{ maxHeight: '25rem' }}
      >
        <div className='space-y-4'>
          {/* Mimic Title and first paragraph structure */}
          <div className='h-8 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
          {/* Title line */}
          <div className='h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
          {/* First paragraph line 1 */}
          <div className='h-4 w-11/12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
          {/* First paragraph line 2 */}
          {/* Mimic Section Heading */}
          <div className='mt-6 h-6 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>
          {/* Mimic More Paragraphs */}
          <div className='mt-6 h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>
          <div className='h-4 w-11/12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>
          <div className='mt-4 h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>
          <div className='h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>
          <div className='h-4 w-10/12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>
        </div>

        {/* Gradient overlay */}
        <div className='absolute right-0 bottom-0 left-0 h-24 bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900'></div>
      </div>
    </div>
  );
}

export function LoadingBodyHeader() {
  return (
    <div className='flex w-full flex-col-reverse gap-6 sm:flex-col'>
      {/* Title Loading - more prominent and title-like */}
      <div className='h-8 w-3/4 animate-pulse self-center rounded-lg bg-neutral-200 sm:self-start dark:bg-neutral-800'></div>

      {/* Author Info and Posted Time Loading - align structure to AuthorInfo and PostedRevisions */}
      <div className='flex flex-col'>
        <div className='flex flex-row items-start justify-between md:items-center'>
          {' '}
          {/* Align items vertically for smaller screens */}
          {/* Author Info Loading - same as AuthorInfo component */}
          <div className='flex flex-row items-center gap-2'>
            <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-200 dark:border-neutral-700'>
              <div className='h-full w-full animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800'></div>{' '}
              {/* Circular Avatar Placeholder */}
            </div>
            <div className='h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
            {/* Author Name Placeholder */}
          </div>
          {/* Posted Time and Revisions Loading - structure similar to PostedRevisions and InitiallyPosted */}
          <div className='flex flex-col items-end gap-2'>
            {' '}
            {/* Align items to the end */}
            <div className='flex flex-row gap-4'>
              {/* Initially Posted - like InitiallyPosted component */}
              <div className='hidden flex-row items-center gap-2 px-2 py-1 sm:flex'>
                <div className='flex flex-col items-end space-y-1'>
                  {' '}
                  {/* Align text to the end */}
                  <div className='h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
                  {/* Label Placeholder */}
                  <div className='h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
                  {/* Time Placeholder */}
                </div>
              </div>

              {/* Latest Revision - like PostedRevisions component structure */}
              <div className='flex flex-row items-center gap-2 bg-white px-2 py-1 dark:bg-neutral-950'>
                <div className='flex flex-col items-end space-y-1'>
                  {' '}
                  {/* Align text to the end */}
                  <div className='h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
                  {/* Revision Label Placeholder */}
                  <div className='h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
                  {/* Revision Time Placeholder */}
                </div>
                <div className='h-6 w-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800'></div>{' '}
                {/* Edit Icon Placeholder */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BodyLoading() {
  return (
    <div className='w-full'>
      {/* Content Loading */}
      <div className='relative'>
        <BodyLoadingContent />
      </div>
    </div>
  );
}

export const AuthorInfo = ({
  authorName,
  authorPicture,
}: {
  authorName: string;
  authorPicture: string;
}) => (
  <div className='flex flex-row items-center gap-2'>
    <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
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
