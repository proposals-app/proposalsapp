import { ImageResponse } from "next/og";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 40,
          color: "white",
          background: "black",
          width: "100%",
          height: "100%",
          padding: "50px 200px",
          textAlign: "center",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        1200x630
      </div>
    ),
  );
}
