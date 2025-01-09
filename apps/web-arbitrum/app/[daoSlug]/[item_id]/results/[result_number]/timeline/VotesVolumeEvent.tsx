interface VotesVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
}

export function VotesVolumeEvent({
  content,
  timestamp,
  volume,
}: VotesVolumeEventProps) {
  return (
    <div className="flex h-full w-full items-center">
      <div
        className="ml-4 h-1 bg-black opacity-0"
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
