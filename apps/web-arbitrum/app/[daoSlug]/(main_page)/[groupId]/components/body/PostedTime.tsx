import * as Tooltip from '@radix-ui/react-tooltip';
import { format, formatDistanceToNow, formatISO } from 'date-fns';
import Image from 'next/image';

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
    <div>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div>
            <div
              className={`flex flex-row items-center gap-2 px-2 py-1 ${border ? 'bg-white' : ''}`}
            >
              <div className='flex flex-col text-xs'>
                <span className='text-neutral-700'>{label}</span>
                <span className='font-bold text-neutral-700'>
                  {relativeTime}
                </span>
              </div>
              {border && (
                <Image
                  src='/assets/web/edit-icon-posted-time.svg'
                  alt={''}
                  width={24}
                  height={24}
                />
              )}
            </div>
          </div>
        </Tooltip.Trigger>

        <Tooltip.Content
          className='max-w-44 rounded border border-neutral-200 bg-white p-2 text-center text-sm
            text-neutral-700 shadow-lg'
          sideOffset={5}
        >
          {formattedDateTime}
        </Tooltip.Content>
      </Tooltip.Root>
    </div>
  );
}
