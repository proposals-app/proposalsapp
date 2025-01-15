import { otel } from "@/lib/otel";
import { AsyncReturnType } from "@/lib/utils";
import { db } from "@proposalsapp/db";

export async function getGroups(daoSlug: string) {
  "use server";
  return otel("get-groups", async () => {
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
      return otel("get-newest-item-timestamp", async () => {
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

        // Fetch the latest proposal and topic timestamps in parallel
        const [latestProposal, latestTopic] = await Promise.all([
          proposalIds.length > 0
            ? db
                .selectFrom("proposal")
                .select("timeCreated")
                .where("id", "in", proposalIds)
                .orderBy("timeCreated", "desc")
                .limit(1)
                .executeTakeFirst()
            : Promise.resolve(null),
          topicIds.length > 0
            ? db
                .selectFrom("discourseTopic")
                .select("createdAt")
                .where("id", "in", topicIds)
                .orderBy("createdAt", "desc")
                .limit(1)
                .executeTakeFirst()
            : Promise.resolve(null),
        ]);

        // Determine the latest timestamp
        const latestTimestamp = Math.max(
          latestProposal?.timeCreated
            ? new Date(latestProposal.timeCreated).getTime()
            : 0,
          latestTopic?.createdAt
            ? new Date(latestTopic.createdAt).getTime()
            : 0,
        );

        return latestTimestamp;
      });
    };

    // Add timestamps to groups in parallel
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
    return groupsWithTimestamps.map(
      ({ newestItemTimestamp, ...group }) => group,
    );
  });
}

export type GroupsType = AsyncReturnType<typeof getGroups>;
