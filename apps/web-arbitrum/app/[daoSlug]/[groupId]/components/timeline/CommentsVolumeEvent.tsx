interface CommentsVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
  last: boolean;
}

export function CommentsVolumeEvent({ volume }: CommentsVolumeEventProps) {
  return (
    <div className='flex h-full w-full items-center'>
      <div
        className='ml-4 h-1 translate-x-[0.5px] bg-neutral-200 dark:bg-neutral-700'
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
