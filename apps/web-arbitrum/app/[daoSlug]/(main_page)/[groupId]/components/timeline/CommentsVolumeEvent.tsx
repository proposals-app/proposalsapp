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
        className='ml-4 h-1 translate-x-[1px] bg-neutral-200'
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
