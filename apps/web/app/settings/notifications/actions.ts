"use server";

import db from "@proposalsapp/db";
import { validateRequest } from "../../../server/auth";

export const updateBulletin = async (enabled: boolean) => {
  let { user } = await validateRequest();

  if (!user) return;

  await db
    .updateTable("userSettings")
    .where("userId", "=", user.id)
    .set({ emailDailyBulletin: enabled ? 1 : 0 })
    .execute();
};

export const updateQuorum = async (enabled: boolean) => {
  let { user } = await validateRequest();

  if (!user) return;

  await db
    .updateTable("userSettings")
    .where("userId", "=", user.id)
    .set({ emailQuorumWarning: enabled ? 1 : 0 })
    .execute();
};

export const updateTimeEnd = async (enabled: boolean) => {
  let { user } = await validateRequest();

  if (!user) return;

  await db
    .updateTable("userSettings")
    .where("userId", "=", user.id)
    .set({ emailTimeendWarning: enabled ? 1 : 0 })
    .execute();
};

export const getUserSettings = async () => {
  let { user } = await validateRequest();
  if (!user)
    return {
      bulletinEnabled: false,
      quorumEnabled: false,
      timeEndEnabled: false,
    };

  const u = await db
    .selectFrom("userSettings")
    .where("userId", "=", user.id)
    .select([
      "userSettings.emailDailyBulletin",
      "userSettings.emailQuorumWarning",
      "userSettings.emailTimeendWarning",
    ])
    .executeTakeFirstOrThrow();

  return {
    bulletinEnabled: u?.emailDailyBulletin == 1,
    quorumEnabled: u?.emailQuorumWarning == 1,
    timeEndEnabled: u?.emailTimeendWarning == 1,
  };
};
