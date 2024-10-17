"use server";

import { validateRequest } from "@/lib/auth";
import { AsyncReturnType } from "@/lib/utils";
import { db, ProposalState } from "@proposalsapp/db";

export const getSubscripions = async () => {
  let { user } = await validateRequest();
  if (!user) return;

  const subscriptions = await db
    .selectFrom("subscription")
    .where("subscription.userId", "=", user.id)
    .selectAll()
    .execute();

  return subscriptions;
};

enum StateFilterEnum {
  ALL = "all",
  OPEN = "open",
  CLOSED = "closed",
}

export const getGuestProposals = async (
  state_filter: StateFilterEnum,
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
    .where("markedSpam", "=", false)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select(["dao.name as daoName", "picture as daoPicture"])
    .offset(page * 25)
    .limit(25)
    .where(
      "proposal.daoId",
      "in",
      db_daos.map((d) => d.id),
    );

  if (state_filter == StateFilterEnum.ALL) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      ProposalState.QUEUED,
      ProposalState.DEFEATED,
      ProposalState.EXECUTED,
      ProposalState.EXPIRED,
      ProposalState.SUCCEEDED,
      ProposalState.HIDDEN,
      ProposalState.ACTIVE,
    ]);
    proposals_query = proposals_query.orderBy("proposal.timeEnd", "desc");
  }

  if (state_filter == StateFilterEnum.OPEN) {
    proposals_query = proposals_query.where(
      "proposal.proposalState",
      "=",
      ProposalState.ACTIVE,
    );
    proposals_query = proposals_query.orderBy("timeEnd", "asc");
  }

  if (state_filter == StateFilterEnum.CLOSED) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      ProposalState.QUEUED,
      ProposalState.DEFEATED,
      ProposalState.EXECUTED,
      ProposalState.EXPIRED,
      ProposalState.SUCCEEDED,
      ProposalState.HIDDEN,
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
    .where("dao.hot", "=", true)
    .orderBy("dao.name", "asc")
    .selectAll()
    .execute();

  return daosList;
};

export type hotDaosType = AsyncReturnType<typeof getHotDaos>;
