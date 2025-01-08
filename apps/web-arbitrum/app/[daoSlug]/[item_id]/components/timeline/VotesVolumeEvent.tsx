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
      className={`h-1 rounded-full bg-gray-600`}
      style={{
        width: `${Math.max(volume * 80, 1)}%`,
      }}
    ></div>
  );
}
