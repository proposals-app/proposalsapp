"use server";

import { AsyncReturnType } from "@/lib/utils";
import { db } from "@proposalsapp/db";

enum StateFilterEnum {
  ALL = "all",
  OPEN = "open",
  CLOSED = "closed",
}

export const getGuestProposals = async (
  active: StateFilterEnum,
  daos: string | string[],
  page: number,
) => {
  let daos_query = db.selectFrom("dao");

  if (daos && !Array.isArray(daos))
    daos_query = daos_query.where("dao.slug", "=", daos);

  if (daos && Array.isArray(daos))
    daos_query = daos_query.where("dao.slug", "in", [...daos]);

  let db_daos = await daos_query.selectAll().execute();

  let proposals_query = db
    .selectFrom("proposal")
    .select([
      "proposal.id",
      "proposal.daoId",
      "proposal.name",
      "proposal.url",
      "proposal.timeEnd",
    ])
    .where("proposal.flagged", "=", 0)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .offset(page * 25)
    .limit(25)
    .where(
      "proposal.daoId",
      "in",
      db_daos.map((d) => d.id),
    );

  if (active == StateFilterEnum.ALL) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      "QUEUED",
      "DEFEATED",
      "EXECUTED",
      "EXPIRED",
      "SUCCEEDED",
      "HIDDEN",
      "ACTIVE",
    ]);
    proposals_query = proposals_query.orderBy("proposal.timeEnd", "desc");
  }

  if (active == StateFilterEnum.OPEN) {
    proposals_query = proposals_query.where(
      "proposal.proposalState",
      "=",
      "ACTIVE",
    );
    proposals_query = proposals_query.orderBy("timeEnd", "asc");
  }

  if (active == StateFilterEnum.CLOSED) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      "QUEUED",
      "DEFEATED",
      "EXECUTED",
      "EXPIRED",
      "SUCCEEDED",
      "HIDDEN",
    ]);
    proposals_query = proposals_query.orderBy("timeEnd", "desc");
  }

  proposals_query = proposals_query.orderBy("proposal.name", "asc");

  const proposals = await proposals_query.execute();

  return proposals;
};

export type getGuestProposalsType = AsyncReturnType<typeof getGuestProposals>;

export const getHotDaos = async () => {
  const daosList = await db
    .selectFrom("dao")
    .where("dao.hot", "=", 1)
    .innerJoin("daoSettings", "dao.id", "daoSettings.daoId")
    .orderBy("dao.name", "asc")
    .selectAll()
    .execute();

  return daosList;
};

export type hotDaosType = AsyncReturnType<typeof getHotDaos>;
