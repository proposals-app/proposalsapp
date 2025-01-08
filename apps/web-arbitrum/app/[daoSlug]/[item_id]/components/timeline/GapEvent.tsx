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
        height: `${gapSize}vh`,
        minHeight: "1rem",
        borderLeft: "2px dashed #666",
        margin: "0.5rem 0 0.5rem 50%",
      }}
    ></div>
  );
}
