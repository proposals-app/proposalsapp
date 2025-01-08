interface CommentsVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
}

export function CommentsVolumeEvent({
  content,
  timestamp,
  volume,
}: CommentsVolumeEventProps) {
  return (
    <div
      className={`h-1 rounded-full bg-gray-400`}
      style={{
        width: `${Math.max(volume * 80, 1)}%`,
      }}
    ></div>
  );
}
