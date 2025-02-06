'use client';

import Link from 'next/link';
import { WindowScroller, List, AutoSizer } from 'react-virtualized';

interface Group {
  id: string;
  name: string;
  daoId: string;
}

interface VirtualizedGroupListProps {
  groups: Group[];
}

export function VirtualizedGroupList({ groups }: VirtualizedGroupListProps) {
  const rowRenderer = ({
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
        <Link href={`/${group.id}`} prefetch={true}>
          <div
            className='mb-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all
              duration-200 hover:border-neutral-300 hover:shadow-md'
          >
            <h2 className='text-xl font-semibold text-neutral-700'>
              {group.name}
            </h2>
            <p className='mt-2 text-sm text-neutral-500'>
              View proposals and discussions in the {group.name} group.
            </p>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <WindowScroller>
      {({ height, isScrolling, onChildScroll, scrollTop }) => (
        <AutoSizer disableHeight>
          {({ width }) => (
            <List
              autoHeight
              width={width}
              height={height}
              isScrolling={isScrolling}
              onScroll={onChildScroll}
              scrollTop={scrollTop}
              rowCount={groups.length}
              rowHeight={120} // Adjust this value based on your card height
              rowRenderer={rowRenderer}
              overscanRowCount={5}
            />
          )}
        </AutoSizer>
      )}
    </WindowScroller>
  );
}
