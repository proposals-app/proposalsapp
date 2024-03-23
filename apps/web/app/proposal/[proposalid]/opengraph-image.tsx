import { ImageResponse } from "next/og";
import { getProposalOd } from "./actions";

export const dynamic = "force-dynamic";

export default async function Image({
  params,
}: {
  params: { proposalid: string };
}) {
  const manjari = await fetch(
    new URL(
      `${process.env.WEB_URL}/assets/fonts/og/Manjari-Thin.ttf`,
      import.meta.url,
    ),
  ).then((res) => res.arrayBuffer());

  const poppins = await fetch(
    new URL(
      `${process.env.WEB_URL}/assets/fonts/og/Poppins-Bold.ttf`,
      import.meta.url,
    ),
  ).then((res) => res.arrayBuffer());

  const ogData = await getProposalOd(params.proposalid);
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "50px",
          backgroundColor: "#FAF3F0",
        }}
      >
        <div tw="flex flex-col">
          <div tw="flex flex-row items-start">
            <img
              width={80}
              height={80}
              src={`${process.env.WEB_URL}/${ogData.settings.picture}_medium.png`}
              style={{
                borderRadius: "6px",
              }}
            />
            <p
              tw="pl-[30px]"
              style={{
                fontFamily: "Poppins",
                fontSize: "64px",
                fontWeight: "700",
                lineHeight: "64px",
              }}
            >
              {ogData.dao.name}
            </p>
          </div>

          <p
            style={{
              fontFamily: "Manjari",
              fontSize: "72px",
              fontWeight: "100",
              lineHeight: "92px",
            }}
          >
            {ogData.name}
          </p>
        </div>
        <div tw="flex flex-row justify-end mt-auto">
          <img
            width={228}
            height={48}
            src={`${process.env.WEB_URL}/assets/icons/web/og/proposalsapp_logo.svg`}
            style={{
              borderRadius: "6px",
            }}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Manjari",
          data: manjari,
          style: "normal",
        },
        {
          name: "Poppins",
          data: poppins,
          style: "normal",
        },
      ],
    },
  );
}
