'use client';

import { parseAsBoolean, useQueryState } from 'nuqs';

const COLLAPSED_HEIGHT = '25rem';

import { memo } from 'react';

const BodyContent = memo(
  ({ processedContent }: { processedContent: string }) => {
    const [expanded] = useQueryState(
      'expanded',
      parseAsBoolean.withDefault(false)
    );

    return (
      <div className='relative overflow-hidden'>
        <div
          className={`prose prose-lg max-w-none p-6 ${
            expanded ? 'overflow-visible' : 'overflow-hidden' }`}
          style={{
            maxHeight: expanded ? 'none' : COLLAPSED_HEIGHT,
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: processedContent }}
            className='diff-content'
          />
          {!expanded && (
            <div
              className='from-background absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t
                to-transparent'
            />
          )}
        </div>
      </div>
    );
  }
);

BodyContent.displayName = 'BodyContent';
export { BodyContent };
