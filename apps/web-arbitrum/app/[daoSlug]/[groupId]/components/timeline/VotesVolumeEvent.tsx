interface VotesVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
  last: boolean;
}

export function VotesVolumeEvent({
  content,
  timestamp,
  volume,
  last,
}: VotesVolumeEventProps) {
  return (
    <div className="flex h-full w-full items-center">
      <div
        className="ml-4 h-1 bg-black opacity-30"
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
