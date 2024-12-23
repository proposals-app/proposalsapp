import { AsyncReturnType } from "@/lib/utils";
import { db, ProposalGroup, JsonArray, JsonObject } from "@proposalsapp/db";

export async function getGroups(daoSlug: string) {
  // Fetch the DAO based on the slug
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  // Fetch all groups for the DAO
  const groups = await db
    .selectFrom("proposalGroup")
    .selectAll()
    .where("daoId", "=", dao.id)
    .execute();

  // Function to find the newest item timestamp in a group
  const getNewestItemTimestamp = async (
    group: (typeof groups)[0],
  ): Promise<number> => {
    let latestTimestamp = 0;

    const items = group.items as Array<{
      id: string;
      type: "proposal" | "topic";
    }>;

    // Get proposal ids and topic ids
    const proposalIds = items
      .filter((item) => item.type === "proposal")
      .map((item) => item.id);

    const topicIds = items
      .filter((item) => item.type === "topic")
      .map((item) => item.id);

    // Fetch the latest proposal timestamp
    if (proposalIds.length > 0) {
      try {
        const latestProposal = await db
          .selectFrom("proposal")
          .selectAll()
          .where("id", "in", proposalIds)
          .orderBy("timeCreated", "desc")
          .limit(1)
          .executeTakeFirst();

        if (latestProposal?.timeCreated) {
          latestTimestamp = Math.max(
            latestTimestamp,
            new Date(latestProposal.timeCreated).getTime(),
          );
        }
      } catch (error) {
        console.error("Error fetching proposals:", error);
      }
    }

    // Fetch the latest topic timestamp
    if (topicIds.length > 0) {
      try {
        const latestTopic = await db
          .selectFrom("discourseTopic")
          .selectAll()
          .where("id", "in", topicIds)
          .orderBy("createdAt", "desc")
          .limit(1)
          .executeTakeFirst();

        if (latestTopic?.createdAt) {
          latestTimestamp = Math.max(
            latestTimestamp,
            new Date(latestTopic.createdAt).getTime(),
          );
        }
      } catch (error) {
        console.error("Error fetching topics:", error);
      }
    }

    return latestTimestamp;
  };

  // Add timestamps to groups
  const groupsWithTimestamps = await Promise.all(
    groups.map(async (group) => ({
      ...group,
      newestItemTimestamp: await getNewestItemTimestamp(group),
    })),
  );

  // Sort groups by timestamp
  groupsWithTimestamps.sort(
    (a, b) => b.newestItemTimestamp - a.newestItemTimestamp,
  );

  // Return the sorted groups without the timestamp property
  return groupsWithTimestamps.map(({ newestItemTimestamp, ...group }) => group);
}

export type GroupsType = AsyncReturnType<typeof getGroups>;
