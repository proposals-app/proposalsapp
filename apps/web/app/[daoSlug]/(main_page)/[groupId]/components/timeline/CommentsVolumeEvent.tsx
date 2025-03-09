interface CommentsVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
  last: boolean;
}

export function CommentsVolumeEvent({ volume }: CommentsVolumeEventProps) {
  return (
    <div className='flex h-1 w-full items-center py-1'>
      <div
        className='ml-4 h-1 translate-x-[1px] bg-neutral-300 dark:bg-neutral-700'
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
