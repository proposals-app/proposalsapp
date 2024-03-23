import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: { dao: string } }) {
  if (params && params.dao)
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
          {params.dao} active
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
