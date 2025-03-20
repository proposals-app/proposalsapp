import { formatDistanceToNow } from 'date-fns';

export async function InitiallyPosted({
  label,
  createdAt,
}: {
  label: string;
  createdAt: Date;
}) {
  const relativeTime = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  return (
    <div className={'flex flex-row items-center gap-2 px-2 py-1'}>
      <div className='dark:text-neutral-350 flex flex-col text-xs text-neutral-600'>
        <span className=''>{label}</span>
        <span className='font-bold'>{relativeTime}</span>
      </div>
    </div>
  );
}
