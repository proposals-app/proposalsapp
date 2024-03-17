"use server";

import { db } from "@proposalsapp/db";
import { validateRequest } from "../../../../server/auth";
import { revalidateTag } from "next/cache";

export async function unsubscribe(daoId: string) {
  let { user } = await validateRequest();
  if (!user) return;

  const u = await db
    .selectFrom("user")
    .selectAll()
    .where("user.id", "=", user.id)
    .executeTakeFirstOrThrow();

  const d = await db
    .selectFrom("dao")
    .selectAll()
    .where("dao.id", "=", daoId)
    .executeTakeFirstOrThrow();

  await db
    .deleteFrom("subscription")
    .where("subscription.daoId", "=", d.id)
    .where("subscription.userId", "=", u.id)
    .execute();

  revalidateTag("subscriptions");
}
