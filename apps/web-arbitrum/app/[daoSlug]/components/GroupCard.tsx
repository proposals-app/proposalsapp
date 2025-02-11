'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { GroupLink } from './GroupLink';
import { GroupCookieInitializer } from './GroupCookieInitializer';

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    newestItemTimestamp: number;
    newestPostTimestamp: number;
    newestVoteTimestamp: number;
  };
}

export function GroupCard({ group }: GroupCardProps) {
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number | null>(
    null
  );

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'No activity yet';
    return formatDistanceToNowStrict(timestamp, { addSuffix: true });
  };

  const latestActivityTimestamp = Math.max(
    group.newestItemTimestamp || 0,
    group.newestPostTimestamp || 0,
    group.newestVoteTimestamp || 0
  );

  const hasActivity = latestActivityTimestamp > 0;
  const hasNewActivity =
    lastSeenTimestamp !== null && latestActivityTimestamp > lastSeenTimestamp;

  return (
    <>
      <GroupCookieInitializer
        group={group}
        onSetLastSeenTimestampAction={setLastSeenTimestamp}
      />
      <GroupLink groupId={group.id} timestamp={latestActivityTimestamp}>
        <div
          data-group-id={group.id}
          className='border-neutral-350 dark:border-neutral-650 relative mb-4 h-24 rounded-xs border
            bg-white p-2 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
        >
          <div className='flex h-full flex-col'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-semibold'>{group.name}</h2>
              {hasNewActivity && (
                <div className='bg-brand-accent rounded-full px-2 py-1 text-xs text-white'>
                  New Activity
                </div>
              )}
            </div>

            <div className='mt-auto flex justify-end'>
              <div
                className={`rounded-xs px-3 py-1 text-sm ${
                  hasActivity
                    ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                  }`}
              >
                {hasActivity ? (
                  <>Last activity: {formatTimestamp(latestActivityTimestamp)}</>
                ) : (
                  'No activity yet'
                )}
              </div>
            </div>
          </div>
        </div>
      </GroupLink>
    </>
  );
}
