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
    <div
      className={`ml-4 h-1 bg-black bg-opacity-20`}
      style={{
        width: `${Math.max(volume * 80, 1)}%`,
      }}
    ></div>
  );
}
