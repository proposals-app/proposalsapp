"use server";

import { db, JsonArray } from "@proposalsapp/db";

export async function getGroupDetails(groupId: string) {
  const group = await db
    .selectFrom("proposalGroup")
    .where("id", "=", groupId)
    .selectAll()
    .executeTakeFirst();

  if (!group) {
    return null;
  }

  const items = group.items as JsonArray;

  const proposalIds = items
    .filter((item: any) => item.type === "proposal")
    .map((item: any) => item.id);
  const topicIds = items
    .filter((item: any) => item.type === "topic")
    .map((item: any) => item.id);

  const proposals = await db
    .selectFrom("proposal")
    .where("id", "in", proposalIds)
    .selectAll()
    .execute();

  const topics = await db
    .selectFrom("discourseTopic")
    .where("discourseTopic.id", "in", topicIds)
    .leftJoin(
      "daoDiscourse",
      "discourseTopic.daoDiscourseId",
      "daoDiscourse.id",
    )
    .selectAll()
    .execute();

  return {
    ...group,
    proposals,
    topics,
  };
}
