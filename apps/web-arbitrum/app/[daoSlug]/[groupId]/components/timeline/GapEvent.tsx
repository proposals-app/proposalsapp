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
      <div
        className="ml-30 z-50 h-full w-full"
        style={{
          background: `repeating-linear-gradient(
               to top,
               transparent,
               transparent 5px,
               hsl(var(--background)) 5px,
               hsl(var(--background)) 10px
             )`,
        }}
      />
    </div>
  );
}
