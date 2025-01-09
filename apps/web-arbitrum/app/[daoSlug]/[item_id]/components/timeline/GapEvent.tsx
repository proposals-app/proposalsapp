interface GapEventProps {
  content: string;
  timestamp: Date;
  gapSize: number;
}

export function GapEvent({ content, timestamp, gapSize }: GapEventProps) {
  return (
    <div
      className="w-full opacity-30"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="text-xs text-gray-500">{content}</div>
    </div>
  );
}
