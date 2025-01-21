import * as Tooltip from '@radix-ui/react-tooltip';
import { format, formatDistanceToNow, formatISO } from 'date-fns';

// Helper component to display the time with a tooltip
export async function PostedTime({
  label,
  createdAt,
  border,
}: {
  label: string;
  createdAt: Date;
  border?: true;
}) {
  const relativeTime = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  const formattedDateTime = format(
    formatISO(new Date(createdAt)),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'"
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div>
            <div
              className={`flex flex-row items-center gap-4 p-2 ${
                border
                  ? `rounded-lg border border-neutral-200 bg-white dark:border-neutral-500
                    dark:bg-neutral-600`
                  : ''
                }`}
            >
              <div className='flex flex-col'>
                <span className='text-neutral-700 dark:text-neutral-100'>
                  {label}
                </span>
                <span className='font-bold text-neutral-700 dark:text-neutral-100'>
                  {relativeTime}
                </span>
              </div>
              {border && (
                <div className='h-8 w-8 rounded bg-neutral-350 dark:bg-neutral-800'></div>
              )}
            </div>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className='w-40 rounded p-2 text-center text-xs shadow-lg'
            sideOffset={5}
          >
            <p>{formattedDateTime}</p>
            <Tooltip.Arrow className='' />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
