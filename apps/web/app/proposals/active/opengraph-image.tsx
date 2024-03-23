import { ImageResponse } from "next/og";

export default function Image({
  searchParams,
}: {
  searchParams: { from: string; voted: string; proxy: string };
}) {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ${searchParams.from} - ${searchParams.voted} - ${searchParams.proxy}
      </div>
    ),
  );
}
