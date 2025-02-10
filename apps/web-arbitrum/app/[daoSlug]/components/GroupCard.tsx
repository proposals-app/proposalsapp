import { formatDistanceToNowStrict } from 'date-fns';
import { GroupLink } from './GroupLink';

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

  return (
    <GroupLink groupId={group.id}>
      <div
        className='border-neutral-350 dark:border-neutral-650 relative mb-4 h-24 rounded-xs border
          bg-white p-2 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
      >
        <div className='flex h-full flex-col'>
          {/* Top section with title */}
          <div className='mb-4'>
            <h2 className='text-xl font-semibold'>{group.name}</h2>
          </div>

          {/* Middle section with details */}
          {/* <div className='mb-4 space-y-1 text-sm text-neutral-500 dark:text-neutral-400'>
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
          </div> */}

          {/* Bottom section with activity status */}
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
  );
}
