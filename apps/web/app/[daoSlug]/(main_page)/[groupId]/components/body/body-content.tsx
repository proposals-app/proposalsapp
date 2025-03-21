'use client';

import { parseAsBoolean, useQueryState } from 'nuqs';

const COLLAPSED_HEIGHT = '25rem';

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
          className={`prose prose-lg max-w-none ${expanded ? 'overflow-visible' : 'overflow-hidden'}`}
          style={{
            maxHeight: expanded ? 'none' : COLLAPSED_HEIGHT,
          }}
          onClick={() => {
            if (!expanded) setExpanded(true);
          }}
        >
          <div
            className='diff-content'
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
          {!expanded && (
            <div
              className='absolute right-0 bottom-0 left-0 h-24 bg-linear-to-t from-neutral-50
                to-transparent dark:from-neutral-900'
            />
          )}
        </div>
      </div>
    );
  }
);

BodyContent.displayName = 'BodyContent';
export { BodyContent };
