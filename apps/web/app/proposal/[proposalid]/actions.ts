"use server";

import db from "@proposalsapp/db";
// import ogs from "open-graph-scraper";
import { validateRequest } from "../../../server/auth";

export async function getProposalWithDao(proposalId: string) {
  return await db
    .selectFrom("proposal")
    .innerJoin("dao", "dao.id", "proposal.daoId")
    .innerJoin("daoSettings", "daoSettings.daoId", "dao.id")
    .where("proposal.id", "=", proposalId)
    .select([
      "proposal.id",
      "proposal.name",
      "proposal.discussionUrl",
      "proposal.body",
      "proposal.url",
      "proposal.choices",
      "proposal.quorum",
      "proposal.proposalState",
      "dao.name as daoName",
      "daoSettings.picture as daoPicture",
    ])
    .executeTakeFirstOrThrow();
}

export async function getVotes(proposalId: string) {
  return await db
    .selectFrom("vote")
    .where("vote.proposalId", "=", proposalId)
    .select([
      "vote.choice",
      "vote.votingPower",
      "vote.timeCreated",
      "vote.blockCreated",
      "vote.voterAddress",
    ])
    .execute();
}

export async function getOwnVotes(proposalId: string) {
  let { user } = await validateRequest();
  if (!user) return [];

  let voters = await db
    .selectFrom("voter")
    .leftJoin("userToVoter", "voter.id", "userToVoter.voterId")
    .leftJoin("user", "user.id", "userToVoter.userId")
    .where("user.id", "=", user.id)
    .select("voter.address")
    .execute();

  return await db
    .selectFrom("vote")
    .where("vote.proposalId", "=", proposalId)
    .where("vote.voterAddress", "in", [...voters.map((v) => v.address), ""])
    .select([
      "vote.voterAddress",
      "vote.choice",
      "vote.votingPower",
      "vote.timeCreated",
      "vote.blockCreated",
    ])
    .execute();
}

type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

export type getVotesType = AsyncReturnType<typeof getVotes>;
export type getOwnVotesType = AsyncReturnType<typeof getOwnVotes>;

export async function unfurlUrl(url: string) {
  if (!url) {
    return null;
  }

  return {
    title: "",
    description: "",
    imageSrc: "",
  };

  // return ogs({ url })
  //   .then((response) => {
  //     return {
  //       title: response.result.ogTitle ?? "",
  //       description: response.result.ogDescription ?? "",
  //       imageSrc: response.result.ogImage?.pop()?.url ?? "",
  //     };
  //   })
  //   .catch(() => {
  //     return null;
  //   });
}
