'use client';

import { parseAsBoolean, useQueryState } from 'nuqs';

import { memo } from 'react';

const BodyContent = memo(
  ({ processedContent }: { processedContent: string }) => {
    const [expanded, setExpanded] = useQueryState(
      'expanded',
      parseAsBoolean.withDefault(false)
    );

    return (
      <div className='relative overflow-hidden'>
        <div
          className={`prose prose-lg ${expanded ? 'none' : 'max-h-64 sm:max-h-[25rem]'} max-w-none break-words ${expanded ? 'overflow-visible' : 'overflow-hidden'}`}
          onClick={() => {
            if (!expanded) setExpanded(true);
          }}
        >
          <div
            className='diff-content'
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
          {!expanded && (
            <div className='absolute right-0 bottom-0 left-0 flex h-32 flex-col items-center justify-end bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900'>
              <span className='rounded-sm border border-neutral-300 bg-neutral-50 px-3 py-1 text-sm text-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'>
                Read more
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

BodyContent.displayName = 'BodyContent';
export { BodyContent };
