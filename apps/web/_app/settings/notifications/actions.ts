"use server";

import { db } from "@proposalsapp/db";
import { validateRequest } from "@/lib/auth";

export const updateBulletin = async (enabled: boolean) => {
  let { user } = await validateRequest();

  if (!user) return;

  await db
    .updateTable("userSettings")
    .where("userId", "=", user.id)
    .set({ emailDailyBulletin: enabled })
    .execute();
};

export const updateQuorum = async (enabled: boolean) => {
  let { user } = await validateRequest();

  if (!user) return;

  await db
    .updateTable("userSettings")
    .where("userId", "=", user.id)
    .set({ emailQuorumWarning: enabled })
    .execute();
};

export const updateTimeEnd = async (enabled: boolean) => {
  let { user } = await validateRequest();

  if (!user) return;

  await db
    .updateTable("userSettings")
    .where("userId", "=", user.id)
    .set({ emailTimeendWarning: enabled })
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
    bulletinEnabled: u?.emailDailyBulletin == true,
    quorumEnabled: u?.emailQuorumWarning == true,
    timeEndEnabled: u?.emailTimeendWarning == true,
  };
};
