'use client';

import { useEffect, useState } from 'react';
import { initializeGroupCookie } from '../actions';

interface GroupCookieInitializerProps {
  group: {
    id: string;
    newestItemTimestamp: number;
    newestPostTimestamp: number;
    newestVoteTimestamp: number;
  };
  onSetLastSeenTimestampAction: (timestamp: number) => void;
}

export function GroupCookieInitializer({
  group,
  onSetLastSeenTimestampAction,
}: GroupCookieInitializerProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      const latestActivityTimestamp = Math.max(
        group.newestItemTimestamp || 0,
        group.newestPostTimestamp || 0,
        group.newestVoteTimestamp || 0
      );

      initializeGroupCookie(group.id, latestActivityTimestamp).then(
        (lastSeenTimestamp) => {
          onSetLastSeenTimestampAction(lastSeenTimestamp);
          setIsInitialized(true);
        }
      );
    }
  }, [group, isInitialized, onSetLastSeenTimestampAction]);

  return null;
}
