"use server";

import db from "@proposalsapp/db";
import { validateRequest } from "../../../../server/auth";
import { revalidateTag } from "next/cache";

export async function subscribe(daoId: string) {
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
    .insertInto("subscription")
    .values({
      userId: u.id,
      daoId: d.id,
    })
    .execute();

  revalidateTag("subscriptions");
}
