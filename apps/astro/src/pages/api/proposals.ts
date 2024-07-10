import { getProposals, StateFilterEnum } from "@/lib/db/getProposals";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const state =
    (url.searchParams.get("state") as StateFilterEnum) || StateFilterEnum.OPEN;
  const daos = url.searchParams.getAll("dao");
  const page = parseInt(url.searchParams.get("page") || "0", 10);

  const filteredDaos =
    daos.length === 0 || (daos.length === 1 && daos[0] === "") ? [] : daos;
  console.log({ state, filteredDaos, page });
  const proposals = await getProposals(state, filteredDaos, page);
  return new Response(
    JSON.stringify({
      proposals,
    }),
  );
};
