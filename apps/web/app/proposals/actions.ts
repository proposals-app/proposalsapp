"use server";

import db, { jsonArrayFrom } from "@proposalsapp/db";
import { validateRequest } from "../../server/auth";

export const getSubscribedDAOs = async () => {
  let { user } = await validateRequest();

  if (!user) return await db.selectFrom("dao").selectAll().execute();

  const u = await db
    .selectFrom("user")
    .selectAll()
    .where("user.id", "=", user.id)
    .executeTakeFirstOrThrow();

  const daosList = await db
    .selectFrom("dao")
    .select(["dao.name", "dao.id"])
    .leftJoin("subscription", "subscription.daoId", "dao.id")
    .where("subscription.userId", "=", u.id)
    .execute();

  daosList.sort((a, b) => a.name.localeCompare(b.name || ""));

  return daosList;
};

export async function getProxies() {
  let { user } = await validateRequest();
  if (!user) return [];

  const u = await db
    .selectFrom("user")
    .select(["user.id"])
    .where("user.id", "=", user.id)
    .executeTakeFirstOrThrow();

  const voters = await db
    .selectFrom("userToVoter")
    .where("userToVoter.userId", "=", u.id)
    .leftJoin("voter", "userToVoter.voterId", "voter.id")
    .select(["voter.address", "voter.ens"])
    .execute();

  return voters.map((v) => {
    if (v.address && v.ens) return { address: v.address, ens: v.ens };
    else if (v.address && !v.ens) return { address: v.address, ens: "" };
    else return { address: "", ens: "" };
  });
}

export async function fetchItems(
  active: boolean,
  page: number,
  from: string,
  voted: string,
  proxy: string,
) {
  let { user } = await validateRequest();
  if (!user)
    return {
      proposals: await getGuestProposals(active, page, from),
    };

  return {
    proposals: await getUserProposals(
      user.id,
      active,
      page,
      from,
      voted,
      proxy,
    ),
  };
}

const getUserProposals = async (
  userId: string,
  active: boolean,
  page: number,
  from: string,
  voted: string,
  proxy: string,
) => {
  const u = await db
    .selectFrom("user")
    .selectAll()
    .where("user.id", "=", userId)
    .executeTakeFirstOrThrow();

  const proxies =
    proxy == "any"
      ? await db
          .selectFrom("voter")
          .select("voter.address")
          .leftJoin("userToVoter", "userToVoter.voterId", "voter.id")
          .select("voter.address")
          .where("userToVoter.userId", "=", u.id)
          .execute()
      : [{ address: proxy }];

  let query = db
    .selectFrom("proposal")
    .selectAll("proposal")
    .orderBy("proposal.timeEnd", active ? "asc" : "desc")
    .orderBy("proposal.name", "asc")
    .offset(page * 25)
    .limit(25)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .leftJoin("daoHandler", "proposal.daoHandlerId", "daoHandler.id")
    .select("daoHandler.handlerType as daoHandlerType")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select("vote.voterAddress")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where(
            "vote.voterAddress",
            "in",
            proxies.length ? proxies.map((p) => p.address) : [""],
          ),
      ).as("vote"),
    ])
    .where("proposal.flagged", "=", 0);

  if (from == "any") {
    const userSubscriptions = await db
      .selectFrom("subscription")
      .select("subscription.daoId")
      .where("subscription.userId", "=", u.id)
      .execute();

    const allDAOsIds =
      userSubscriptions.length > 0
        ? userSubscriptions
        : await db.selectFrom("dao").select("dao.id as daoId").execute();

    query = query.where(
      "proposal.daoId",
      "in",
      allDAOsIds.map((d) => d.daoId),
    );
  } else {
    const fromDaoId = await db
      .selectFrom("dao")
      .select("dao.id")
      .where(({ eb }) =>
        eb(eb.fn("upper", ["dao.name"]), "=", from.toUpperCase()),
      )
      .where("dao.name", "like", from)
      .executeTakeFirstOrThrow();

    query = query.where("proposal.daoId", "=", fromDaoId.id);
  }

  if (active) query = query.where("proposal.proposalState", "in", ["ACTIVE"]);
  else
    query = query.where("proposal.proposalState", "in", [
      "QUEUED",
      "DEFEATED",
      "EXECUTED",
      "EXPIRED",
      "SUCCEEDED",
      "HIDDEN",
      "CANCELED",
    ]);

  if (voted == "yes") {
    query = query.where(({ eb, selectFrom }) =>
      eb(
        "proposal.id",
        "in",
        selectFrom("vote")
          .select("vote.proposalId")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where(
            "vote.voterAddress",
            "in",
            proxies.length ? proxies.map((p) => p.address) : [""],
          ),
      ),
    );
  } else if (voted == "no") {
    query = query.where(({ eb, selectFrom }) =>
      eb(
        "proposal.id",
        "not in",
        selectFrom("vote")
          .select("vote.proposalId")
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where(
            "vote.voterAddress",
            "in",
            proxies.length ? proxies.map((p) => p.address) : [""],
          ),
      ),
    );
  }

  return await query.execute();
};

const getGuestProposals = async (
  active: boolean,
  page: number,
  from: string,
) => {
  const allDAOsIds = await db.selectFrom("dao").select("dao.id").execute();

  let query = db
    .selectFrom("proposal")
    .selectAll("proposal")
    .orderBy("proposal.timeEnd", active ? "asc" : "desc")
    .orderBy("proposal.name", "asc")
    .offset(page * 25)
    .limit(25)
    .leftJoin("dao", "proposal.daoId", "dao.id")
    .select("dao.name as daoName")
    .leftJoin("daoSettings", "proposal.daoId", "daoSettings.daoId")
    .select("daoSettings.picture as daoPicture")
    .leftJoin("daoHandler", "proposal.daoHandlerId", "daoHandler.id")
    .select("daoHandler.handlerType as daoHandlerType")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("vote")
          .select(["vote.voterAddress"])
          .whereRef("vote.proposalId", "=", "proposal.id")
          .where("vote.voterAddress", "in", ["deadbeef"]),
      ).as("vote"),
    ])
    .where("proposal.flagged", "=", 0);

  if (active) query = query.where("proposal.proposalState", "=", "ACTIVE");
  else
    query = query.where("proposal.proposalState", "in", [
      "QUEUED",
      "DEFEATED",
      "EXECUTED",
      "EXPIRED",
      "SUCCEEDED",
      "CANCELED",
      "HIDDEN",
    ]);

  if (from == "any")
    query = query.where(
      "proposal.daoId",
      "in",
      allDAOsIds.map((d) => d.id),
    );
  else {
    const fromDaoId = await db
      .selectFrom("dao")
      .select("dao.id")
      .where(({ eb }) =>
        eb(eb.fn("upper", ["dao.name"]), "=", from.toUpperCase()),
      )
      .where("dao.name", "like", from)
      .executeTakeFirstOrThrow();

    query = query.where("proposal.daoId", "=", fromDaoId.id);
  }

  return await query.execute();
};

type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

export type fetchItemsType = AsyncReturnType<typeof fetchItems>;
export type getProxiesType = AsyncReturnType<typeof getProxies>;
