import { formatDistanceToNow } from 'date-fns';
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

  return (
    <div
      className={`flex flex-row items-center gap-2 px-2 py-1
        ${border ? 'bg-white dark:bg-neutral-950' : ''}`}
    >
      <div className='dark:text-neutral-350 flex flex-col text-xs text-neutral-600'>
        <span className=''>{label}</span>
        <span className='font-bold'>{relativeTime}</span>
      </div>
      {border && (
        <Image
          src={`https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/web/edit-icon-posted-time.svg`}
          alt={''}
          width={24}
          height={24}
        />
      )}
    </div>
  );
}
