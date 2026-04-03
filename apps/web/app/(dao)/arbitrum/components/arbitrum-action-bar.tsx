interface ArbitrumActionBarProps {
  hasNewActivity: boolean;
  signedIn: boolean;
  onMarkAllAsRead?: () => void;
  isMarkingAsRead?: boolean;
}

export function ArbitrumActionBar({
  hasNewActivity,
  signedIn,
  onMarkAllAsRead,
  isMarkingAsRead = false,
}: ArbitrumActionBarProps) {
  const showMarkAllAsRead = signedIn && hasNewActivity;

  return (
    <div className='mb-6 flex min-h-[2.25rem] flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
      <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
        All Proposal Groups
      </h2>
      <div className='flex h-9 items-center'>
        {showMarkAllAsRead && (
          <button
            onClick={onMarkAllAsRead}
            disabled={isMarkingAsRead}
            className={`rounded-xs px-4 py-2 text-sm font-medium transition-colors ${
              isMarkingAsRead
                ? 'cursor-not-allowed bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
                : 'bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-800 dark:hover:bg-neutral-300'
            } `}
          >
            {isMarkingAsRead ? 'Marking as read...' : 'Mark all as read'}
          </button>
        )}
      </div>
    </div>
  );
}
