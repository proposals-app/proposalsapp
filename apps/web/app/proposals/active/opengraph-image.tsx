import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export default function Image({
  searchParams,
}: {
  searchParams: { from: string; voted: string; proxy: string };
}) {
  if (searchParams && searchParams.from)
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
          ${searchParams.from}
        </div>
      ),
    );
  else
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
          All daos???
        </div>
      ),
    );
}
