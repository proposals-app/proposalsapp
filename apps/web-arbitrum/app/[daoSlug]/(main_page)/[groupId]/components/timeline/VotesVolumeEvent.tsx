interface VotesVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
  last: boolean;
}

export function VotesVolumeEvent({ volume }: VotesVolumeEventProps) {
  return (
    <div className='flex h-1 w-full items-center'>
      <div
        className='ml-4 h-1 translate-x-[1px] bg-neutral-400 dark:bg-neutral-500'
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
