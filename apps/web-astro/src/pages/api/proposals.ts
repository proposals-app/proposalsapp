import { getProposals, StateFilterEnum } from "@/lib/db/getProposals";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const state =
    (url.searchParams.get("state") as StateFilterEnum) || StateFilterEnum.OPEN;
  const daos = url.searchParams.get("daos")?.split(",") || [];
  const page = parseInt(url.searchParams.get("page") || "0", 10);

  console.log({ state, daos, page });

  try {
    const proposals = await getProposals(state, daos, page);
    return new Response(
      JSON.stringify({
        proposals,
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch proposals",
      }),
      { status: 500 },
    );
  }
};
