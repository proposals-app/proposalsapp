import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: { dao: string } }) {
  // if (params && params.dao) {
  //   const ogData = await getDaoOG(params.dao);
  //   console.log(ogData);
  //   return new ImageResponse(
  //     (
  //       <div
  //         style={{
  //           height: "100%",
  //           width: "100%",
  //           display: "flex",
  //           flexDirection: "column",
  //           padding: "50px",
  //           backgroundColor: "#FAF3F0",
  //         }}
  //       >
  //         <div tw="flex flex-col">
  //           <div tw="flex flex-row items-center">
  //             <img
  //               width={80}
  //               height={80}
  //               src={`${process.env.WEB_URL}/${ogData.settings.picture}_medium.png`}
  //               style={{
  //                 borderRadius: "6px",
  //               }}
  //             />
  //             <p tw="pl-[30px] text-[64px]">{ogData.dao.name}</p>
  //           </div>
  //         </div>
  //       </div>
  //     ),
  //   );
  // } else
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
          backgroundColor: "#FAF3F0",
        }}
      >
        All daos???
      </div>
    ),
  );
}
