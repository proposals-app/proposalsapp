export function GapEvent() {
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

export function VotesVolumeEvent({ volume }: VotesVolumeEventProps) {
  return (
    <div className="flex h-full w-full items-center">
      <div
        className="ml-4 h-1 opacity-0"
        style={{
          width: `${Math.max(volume * 80, 1)}%`,
        }}
      />
    </div>
  );
}

export function CommentsVolumeEvent() {
  return (
    <div className="flex h-full w-full items-center">
      <div className="ml-4 h-1" />
    </div>
  );
}

export function BasicEvent() {
  return (
    <div className="relative mr-4 flex h-8 w-full items-center py-2"></div>
  );
}
