"use server";

import { db, JsonArray } from "@proposalsapp/db";
import { revalidatePath } from "next/cache";
import Fuse from "fuse.js";

export interface ProposalGroup {
  id?: string;
  name: string;
  items: ProposalGroupItem[];
  createdAt?: string;
}

export interface ProposalGroupItem {
  id: string;
  type: "proposal" | "topic";
  name: string;
  indexerName: string;
}

export async function fetchData() {
  try {
    const proposalGroups = await db
      .selectFrom("proposalGroup")
      .selectAll()
      .orderBy("createdAt", "desc")
      .execute();

    const groupsWithItems = await Promise.all(
      proposalGroups.map(async (group) => {
        const items = group.items as unknown as ProposalGroupItem[];
        const itemsWithIndexerName = await Promise.all(
          items.map(async (item) => {
            let indexerName = "unknown";
            if (item.type === "proposal") {
              const proposal = await db
                .selectFrom("proposal")
                .leftJoin(
                  "daoHandler",
                  "daoHandler.id",
                  "proposal.daoHandlerId",
                )
                .select("handlerType")
                .where("proposal.id", "=", item.id)
                .executeTakeFirst();
              indexerName = proposal?.handlerType ?? "unknown";
            } else if (item.type === "topic") {
              const topic = await db
                .selectFrom("discourseTopic")
                .leftJoin(
                  "daoDiscourse",
                  "daoDiscourse.id",
                  "discourseTopic.daoDiscourseId",
                )
                .select("daoDiscourse.discourseBaseUrl")
                .where("discourseTopic.id", "=", item.id)
                .executeTakeFirst();
              indexerName = topic?.discourseBaseUrl ?? "unknown";
            }
            return { ...item, indexerName };
          }),
        );

        return {
          ...group,
          id: group.id.toString(),
          items: itemsWithIndexerName,
          createdAt: group.createdAt.toISOString(),
        };
      }),
    );

    return {
      proposalGroups: groupsWithItems,
    };
  } catch (error) {
    console.error("Error fetching proposal groups:", error);
    throw new Error("Failed to fetch proposal groups");
  }
}

export interface FuzzyItem {
  id: string;
  type: "proposal" | "topic";
  name: string;
  indexerName: string;
  score: number;
}

export async function fuzzySearchItems(
  searchTerm: string,
): Promise<FuzzyItem[]> {
  const proposals = await db
    .selectFrom("proposal")
    .leftJoin("daoHandler", "daoHandler.id", "proposal.daoHandlerId")
    .select(["proposal.id", "proposal.name", "handlerType"])
    .execute();

  const topics = await db
    .selectFrom("discourseTopic")
    .leftJoin(
      "daoDiscourse",
      "daoDiscourse.id",
      "discourseTopic.daoDiscourseId",
    )
    .select(["discourseTopic.id", "title", "daoDiscourse.discourseBaseUrl"])
    .execute();

  const allItems: FuzzyItem[] = [
    ...proposals.map((p) => ({
      id: p.id.toString(),
      name: p.name,
      type: "proposal" as const,
      indexerName: p.handlerType ?? "unknown",
      score: 1,
    })),
    ...topics.map((t) => ({
      id: t.id.toString(),
      name: t.title,
      type: "topic" as const,
      indexerName: t.discourseBaseUrl ?? "unknown",
      score: 1,
    })),
  ];

  if (allItems.length === 0) {
    return [];
  }

  const fuse = new Fuse(allItems, {
    keys: ["name"],
    threshold: 0.5,
    includeScore: true,
  });

  const searchResults = fuse.search(searchTerm);

  console.log(searchResults);
  const results = searchResults.slice(0, 100).map((result) => ({
    ...result.item,
    score: result.score ?? 1.0,
  }));

  return results;
}

export async function saveGroups(groups: ProposalGroup[]) {
  for (const group of groups) {
    if (group.id) {
      const existingGroup = await db
        .selectFrom("proposalGroup")
        .where("id", "=", group.id)
        .executeTakeFirst();

      if (existingGroup) {
        // Update existing group
        await db
          .updateTable("proposalGroup")
          .set({
            name: group.name,
            items: JSON.stringify(group.items),
          })
          .where("id", "=", group.id)
          .execute();
      } else {
        // Insert new group with existing id
        await db
          .insertInto("proposalGroup")
          .values({
            id: group.id,
            name: group.name,
            items: JSON.stringify(group.items),
          })
          .execute();
      }
    } else {
      // Insert new group without id
      await db
        .insertInto("proposalGroup")
        .values({
          name: group.name,
          items: JSON.stringify(group.items),
        })
        .execute();
    }
  }

  revalidatePath("/mapping");
}

export async function deleteGroup(groupId: string) {
  try {
    await db.deleteFrom("proposalGroup").where("id", "=", groupId).execute();

    revalidatePath("/mapping");
  } catch (error) {
    throw new Error("Failed to delete group");
  }
}
