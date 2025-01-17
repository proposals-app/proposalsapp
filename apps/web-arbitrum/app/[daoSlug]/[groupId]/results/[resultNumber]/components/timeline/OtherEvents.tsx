interface GapEventProps {
  content: string;
  timestamp: Date;
  gapSize: number;
}

export function GapEvent({ content, timestamp, gapSize }: GapEventProps) {
  return (
    <div
      className="relative min-h-[40px] w-full"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="ml-30 z-50 h-full w-full" />
    </div>
  );
}

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
        className="ml-4 h-1 bg-muted-foreground opacity-0"
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}

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
      <div className="ml-4 h-1" />
    </div>
  );
}

interface BasicEventProps {
  content: string;
  timestamp: Date;
  url: string;
}

export function BasicEvent({ content, timestamp, url }: BasicEventProps) {
  return (
    <div className="relative mr-4 flex h-8 w-full items-center py-2"></div>
  );
}
