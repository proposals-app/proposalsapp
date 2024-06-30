"use server";

import { validateRequest } from "@/lib/auth";
import { db, jsonArrayFrom } from "@proposalsapp/db";
import { ProposalStateEnum } from "@proposalsapp/db/src/kysely_db";

export const getSubscriptions = async () => {
  const subscribed = await getSubscribedDAOs();
  const unsubscribed = await getUnsubscribedDAOs(subscribed);

  return { subscribed, unsubscribed };
};

const getSubscribedDAOs = async () => {
  let { user } = await validateRequest();
  if (!user) return [];

  const u = await db
    .selectFrom("user")
    .selectAll()
    .where("user.id", "=", user.id)
    .executeTakeFirstOrThrow();

  const daosList = await db
    .selectFrom("dao")
    .select(["dao.name", "dao.id"])
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("daoHandler")
          .select(["daoHandler.handlerType as handlerType"])
          .whereRef("daoHandler.daoId", "=", "dao.id"),
      ).as("handlers"),
    ])
    .leftJoin("daoSettings", "daoSettings.daoId", "dao.id")
    .select("daoSettings.backgroundColor as backgroundColor")
    .select("daoSettings.picture as picture")
    .leftJoin("subscription", "subscription.daoId", "dao.id")
    .where("subscription.userId", "=", u.id)
    .select((subQuery) =>
      subQuery
        .selectFrom("proposal")
        .whereRef("proposal.daoId", "=", "dao.id")
        .where("proposal.proposalState", "=", ProposalStateEnum.ACTIVE)
        .select((sub) => sub.fn.count("id").as("activeProposalsCount"))
        .as("activeProposalsCount"),
    )
    .execute();

  daosList.sort((a, b) => a.name.localeCompare(b.name || ""));

  return daosList;
};

const getUnsubscribedDAOs = async (subscribed: SubscribedDAOsType) => {
  let { user } = await validateRequest();

  let daosList = await db
    .selectFrom("dao")
    .select(["dao.name", "dao.id"])
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("daoHandler")
          .select(["daoHandler.handlerType as handlerType"])
          .whereRef("daoHandler.daoId", "=", "dao.id"),
      ).as("handlers"),
    ])
    .leftJoin("daoSettings", "daoSettings.daoId", "dao.id")
    .select("daoSettings.backgroundColor as backgroundColor")
    .select("daoSettings.picture as picture")
    .execute();

  if (!user)
    return daosList.sort((a, b) => a.name!.localeCompare(b.name || ""));

  daosList = daosList
    .filter((d) => !subscribed.map((sub) => sub.id).includes(d.id))
    .sort((a, b) => a.name!.localeCompare(b.name || ""));

  return daosList;
};

export type UnsubscribedDAOsType = Awaited<
  ReturnType<typeof getUnsubscribedDAOs>
>;
export type SubscribedDAOsType = Awaited<ReturnType<typeof getSubscribedDAOs>>;
