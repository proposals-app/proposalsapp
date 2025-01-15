interface GapEventProps {
  content: string;
  timestamp: Date;
  gapSize: number;
  last: boolean;
}

export function GapEvent({ content, timestamp, gapSize, last }: GapEventProps) {
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
      <div className="ml-30 z-50 h-full w-full bg-[repeating-linear-gradient(to_top,transparent,transparent_5px,#f3f4f6_5px,#f3f4f6_10px)]" />
    </div>
  );
}
