interface CommentsVolumeEventProps {
  content: string;
  timestamp: Date;
  volume: number;
  last: boolean;
}

export function CommentsVolumeEvent({
  content,
  timestamp,
  volume,
  last,
}: CommentsVolumeEventProps) {
  return (
    <div className="flex h-full w-full items-center">
      <div
        className="ml-4 h-1 bg-muted-foreground opacity-50"
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}
