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
      className={`ml-4 h-[3px] bg-black bg-opacity-30`}
      style={{
        width: `${Math.max(volume * 80, 1)}%`,
      }}
    ></div>
  );
}
