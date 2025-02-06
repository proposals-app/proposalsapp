'use client';

import Link from 'next/link';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { memo, useCallback, type RefCallback } from 'react';

interface Group {
  id: string;
  name: string;
  daoId: string;
}

interface GroupCardProps {
  group: Group;
}

interface VirtualizedGroupListProps {
  groups: Group[];
}

// Memoized GroupCard component
const GroupCard = memo(({ group }: GroupCardProps) => (
  <Link href={`/${group.id}`} prefetch={true}>
    <div
      className='mb-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all
        duration-200 hover:border-neutral-300 hover:shadow-md'
    >
      <h2 className='text-xl font-semibold text-neutral-700'>{group.name}</h2>
      <p className='mt-2 text-sm text-neutral-500'>
        View proposals and discussions in the {group.name} group.
      </p>
    </div>
  </Link>
));

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

  // After hydration, show virtualized list
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
                rowHeight={120}
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
