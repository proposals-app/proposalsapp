import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: { dao: string } }) {
  // if (params && params.dao)
  //   return new ImageResponse(
  //     (
  //       <div
  //         style={{
  //           height: "100%",
  //           width: "100%",
  //           display: "flex",
  //           flexDirection: "column",
  //           alignItems: "center",
  //           justifyContent: "center",
  //           backgroundColor: "#FAF3F0",
  //         }}
  //       >
  //         {params.dao} active
  //       </div>
  //     ),
  //   );
  // else
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#CFD9DE",
        }}
      >
        All daos???
      </div>
    ),
  );
}
