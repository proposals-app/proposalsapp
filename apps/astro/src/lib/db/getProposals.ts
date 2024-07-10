import { db, ProposalStateEnum } from "@proposalsapp/db";
import type { AsyncReturnType } from "../utils";

export enum StateFilterEnum {
  ALL = "all",
  OPEN = "open",
  CLOSED = "closed",
}

export const getProposals = async (
  active: StateFilterEnum,
  daos: string | string[],
  page: number,
) => {
  console.log({ active, daos, page });
  let daos_query = db.selectFrom("dao");

  if (daos.length) daos_query = daos_query.where("dao.slug", "in", daos);

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
    .where("proposal.flagged", "=", false)
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
      ProposalStateEnum.QUEUED,
      ProposalStateEnum.DEFEATED,
      ProposalStateEnum.EXECUTED,
      ProposalStateEnum.EXPIRED,
      ProposalStateEnum.SUCCEEDED,
      ProposalStateEnum.HIDDEN,
      ProposalStateEnum.ACTIVE,
    ]);
    proposals_query = proposals_query.orderBy("proposal.timeEnd", "desc");
  }

  if (active == StateFilterEnum.OPEN) {
    proposals_query = proposals_query.where(
      "proposal.proposalState",
      "=",
      ProposalStateEnum.ACTIVE,
    );
    proposals_query = proposals_query.orderBy("timeEnd", "asc");
  }

  if (active == StateFilterEnum.CLOSED) {
    proposals_query = proposals_query.where("proposal.proposalState", "in", [
      ProposalStateEnum.QUEUED,
      ProposalStateEnum.DEFEATED,
      ProposalStateEnum.EXECUTED,
      ProposalStateEnum.EXPIRED,
      ProposalStateEnum.SUCCEEDED,
      ProposalStateEnum.HIDDEN,
    ]);
    proposals_query = proposals_query.orderBy("timeEnd", "desc");
  }

  proposals_query = proposals_query.orderBy("proposal.name", "asc");

  const proposals = await proposals_query.execute();

  return proposals;
};

export type getGuestProposalsType = AsyncReturnType<typeof getProposals>;
