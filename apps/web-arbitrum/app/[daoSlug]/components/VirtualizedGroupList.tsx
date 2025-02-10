'use client';

import { WindowScroller, List, AutoSizer } from 'react-virtualized';
import { useCallback, type RefCallback } from 'react';
import { GroupCard } from './GroupCard';

interface VirtualizedGroupListProps {
  groups: Array<{
    id: string;
    name: string;
    newestItemTimestamp: number;
    newestPostTimestamp: number;
    newestVoteTimestamp: number;
  }>;
}

export function VirtualizedGroupList({ groups }: VirtualizedGroupListProps) {
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
    <WindowScroller serverHeight={2400} serverWidth={1200}>
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
                rowHeight={96 + 8}
                rowRenderer={rowRenderer}
                overscanRowCount={5}
              />
            </div>
          )}
        </AutoSizer>
      )}
    </WindowScroller>
  );
}
