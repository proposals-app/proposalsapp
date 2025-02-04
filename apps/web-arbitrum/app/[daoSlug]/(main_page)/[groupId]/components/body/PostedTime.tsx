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
    <div
      className={`flex flex-row items-center gap-2 px-2 py-1
        ${border ? 'bg-white dark:bg-black' : ''}`}
    >
      <div className='dark:text-neutral-350 flex flex-col text-xs text-neutral-600'>
        <span className=''>{label}</span>
        <span className='font-bold'>{relativeTime}</span>
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
  );
}
