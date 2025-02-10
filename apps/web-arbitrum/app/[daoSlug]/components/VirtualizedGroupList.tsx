'use client';

import Link from 'next/link';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { memo, useCallback, type RefCallback } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';

interface Group {
  id: string;
  name: string;
  daoId: string;
  newestActivityTimestamp: number;
  newestItemTimestamp: number;
  newestPostTimestamp: number;
  newestVoteTimestamp: number;
}

interface GroupCardProps {
  group: Group;
}

interface VirtualizedGroupListProps {
  groups: Group[];
}

// Memoized GroupCard component
const GroupCard = memo(({ group }: GroupCardProps) => {
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'No activity yet';
    return formatDistanceToNowStrict(timestamp, { addSuffix: true });
  };

  // Calculate the latest activity timestamp from all available timestamps
  const latestActivityTimestamp = Math.max(
    group.newestItemTimestamp || 0,
    group.newestPostTimestamp || 0,
    group.newestVoteTimestamp || 0
  );

  const hasActivity = latestActivityTimestamp > 0;

  return (
    <Link href={`/${group.id}`} prefetch={true}>
      <div
        className='border-neutral-350 dark:border-neutral-650 mb-4 rounded-xs border bg-white p-2
          text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
      >
        <div className='flex items-start justify-between'>
          <h2 className='text-xl font-semibold'>{group.name}</h2>
          <div
            className={`rounded-xs px-3 py-1 text-sm ${
              hasActivity
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
          >
            {hasActivity ? (
              <>Last activity: {formatTimestamp(latestActivityTimestamp)}</>
            ) : (
              'No activity yet'
            )}
          </div>
        </div>
        <div className='mt-4 space-y-1 text-sm text-neutral-500 dark:text-neutral-400'>
          <p>
            <span className='font-medium'>Latest created item:</span>{' '}
            {formatTimestamp(group.newestItemTimestamp)}
          </p>
          <p>
            <span className='font-medium'>Latest post:</span>{' '}
            {formatTimestamp(group.newestPostTimestamp)}
          </p>
          <p>
            <span className='font-medium'>Latest vote:</span>{' '}
            {formatTimestamp(group.newestVoteTimestamp)}
          </p>
        </div>
      </div>
    </Link>
  );
});

GroupCard.displayName = 'GroupCard';

export const VirtualizedGroupList = memo(function VirtualizedGroupList({
  groups,
}: VirtualizedGroupListProps) {
  const rowRenderer = useCallback(
    ({
      key,
      index,
      style,
    }: {
      key: string;
      index: number;
      style: React.CSSProperties;
    }) => {
      const group = groups[index];
      return (
        <div key={key} style={style}>
          <GroupCard group={group} />
        </div>
      );
    },
    [groups]
  );

  return (
    <WindowScroller serverHeight={800} serverWidth={1200}>
      {({ height, isScrolling, onChildScroll, scrollTop, registerChild }) => (
        <AutoSizer disableHeight>
          {({ width }) => (
            <div ref={registerChild as RefCallback<HTMLDivElement>}>
              <List
                autoHeight
                width={width}
                height={height}
                isScrolling={isScrolling}
                onScroll={onChildScroll}
                scrollTop={scrollTop}
                rowCount={groups.length}
                rowHeight={160}
                rowRenderer={rowRenderer}
                overscanRowCount={5}
              />
            </div>
          )}
        </AutoSizer>
      )}
    </WindowScroller>
  );
});
