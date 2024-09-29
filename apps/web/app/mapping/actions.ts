"use server";

import { db } from "@proposalsapp/db";
import { revalidatePath } from "next/cache";
import Fuse from "fuse.js";

export interface ProposalGroup {
  id?: string;
  name: string;
  items: ProposalGroupItem[];
}

export interface ProposalGroupItem {
  id: string;
  type: "proposal" | "topic";
  name: string;
}

export async function fetchData() {
  const proposalGroups = await db
    .selectFrom("proposalGroup")
    .selectAll()
    .execute();

  return {
    proposalGroups: proposalGroups.map((group) => ({
      ...group,
      id: group.id.toString(),
      items: parseItems(group.items),
    })),
  };
}

function parseItems(items: unknown): ProposalGroupItem[] {
  if (Array.isArray(items)) {
    return items.map((item) => ({
      id: item.id.toString(),
      type: item.type as "proposal" | "topic",
      name: item.name,
    }));
  }
  return [];
}

export async function searchItems(searchTerm: string) {
  "use server";

  const proposals = await db
    .selectFrom("proposal")
    .select(["id", "name", "externalId"])
    .execute();

  const topics = await db
    .selectFrom("discourseTopic")
    .select(["id", "title", "externalId"])
    .execute();

  const allItems = [
    ...proposals.map((p) => ({
      id: p.id.toString(),
      name: p.name,
      type: "proposal" as const,
    })),
    ...topics.map((t) => ({
      id: t.id.toString(),
      name: t.title,
      type: "topic" as const,
    })),
  ];

  const fuse = new Fuse(allItems, {
    keys: ["name"],
    threshold: 0.3,
  });

  const results = searchTerm
    ? fuse.search(searchTerm).map((result) => result.item)
    : allItems;

  return results.slice(0, 100); // Limit to 100 results
}

export async function saveGroups(groups: ProposalGroup[]) {
  console.log(groups);

  for (const group of groups) {
    await db
      .insertInto("proposalGroup")
      .values({ name: group.name, items: JSON.stringify(group.items) })
      .execute();
  }

  revalidatePath("/mapping");
}
