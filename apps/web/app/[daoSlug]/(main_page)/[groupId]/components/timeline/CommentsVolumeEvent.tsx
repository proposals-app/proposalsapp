import { unstable_ViewTransition as ViewTransition } from 'react';

interface CommentsVolumeEventProps {
  timestamp: Date;
  width: number;
  last: boolean;
  index: number;
}

export function CommentsVolumeEvent({
  width,
  index,
}: CommentsVolumeEventProps) {
  return (
    <ViewTransition name={`comments-${index}`}>
      <div className='flex min-h-1 w-full items-center py-[1px]'>
        <div
          className='ml-4 min-h-1 translate-x-[1px] bg-neutral-300 dark:bg-neutral-700'
          style={{
            width: `${Math.max(width * 80, 1)}%`,
          }}
        />
      </div>
    </ViewTransition>
  );
}
