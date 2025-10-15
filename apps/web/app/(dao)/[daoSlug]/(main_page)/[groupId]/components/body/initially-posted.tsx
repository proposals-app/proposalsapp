import { formatDistanceToNow } from 'date-fns';

export function InitiallyPosted({ createdAt }: { createdAt: Date }) {
  const relativeTime = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  return (
    <div className={'flex w-[140px] flex-row items-center gap-2 p-2'}>
      <div className='flex flex-col items-start text-xs text-neutral-600 dark:text-neutral-350'>
        <span className='truncate'>initially posted</span>
        <span className='truncate font-bold'>{relativeTime}</span>
      </div>
    </div>
  );
}
