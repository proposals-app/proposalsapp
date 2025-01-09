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
    <div className="flex h-full w-full items-center">
      <div
        className="ml-4 h-1 bg-black opacity-10"
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
