import { otel } from "@/lib/otel";
import { db, DiscourseTopic, Proposal, Selectable } from "@proposalsapp/db";

export type Body = {
  author_name: string;
  author_picture: string;
};

export async function getAuthor(groupID: string) {
  "use server";
  return otel("get-author", async () => {
    const bodies: Body[] = [];

    const group = await db
      .selectFrom("proposalGroup")
      .selectAll()
      .where("id", "=", groupID)
      .executeTakeFirstOrThrow();

    if (!group) {
      return null;
    }

    const items = group.items as Array<{
      id: string;
      type: "proposal" | "topic";
    }>;

    const proposalIds = items
      .filter((item) => item.type === "proposal")
      .map((item) => item.id);

    const topicIds = items
      .filter((item) => item.type === "topic")
      .map((item) => item.id);

    let proposals: Selectable<Proposal>[] = [];
    if (proposalIds.length > 0) {
      try {
        proposals = await db
          .selectFrom("proposal")
          .selectAll()
          .where("proposal.id", "in", proposalIds)
          .execute();
      } catch (error) {
        console.error("Error fetching proposals:", error);
      }
    }

    proposals.map((proposal) =>
      bodies.push({
        author_name: proposal.author ?? "Unknown",
        author_picture: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${proposal.author}`,
      }),
    );

    let discourseTopics: Selectable<DiscourseTopic>[] = [];
    if (topicIds.length > 0) {
      try {
        discourseTopics = await db
          .selectFrom("discourseTopic")
          .selectAll()
          .where("discourseTopic.id", "in", topicIds)
          .execute();
      } catch (error) {
        console.error("Error fetching topics:", error);
      }
    }

    for (const discourseTopic of discourseTopics) {
      const discourseFirstPost = await db
        .selectFrom("discoursePost")
        .where("discoursePost.topicId", "=", discourseTopic.externalId)
        .where("daoDiscourseId", "=", discourseTopic.daoDiscourseId)
        .where("discoursePost.postNumber", "=", 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostAuthor = await db
        .selectFrom("discourseUser")
        .where("discourseUser.externalId", "=", discourseFirstPost.userId)
        .where("daoDiscourseId", "=", discourseTopic.daoDiscourseId)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostRevisions = await db
        .selectFrom("discoursePostRevision")
        .where(
          "discoursePostRevision.discoursePostId",
          "=",
          discourseFirstPost.id,
        )
        .selectAll()
        .execute();

      // If there are no revisions, use the post itself
      if (!discourseFirstPostRevisions.length)
        bodies.push({
          author_name:
            discourseFirstPostAuthor.name ??
            discourseFirstPostAuthor.username ??
            "Unknown",
          author_picture: discourseFirstPostAuthor.avatarTemplate,
        });

      for (const discourseFirstPostRevision of discourseFirstPostRevisions) {
        // If there are revisions, the initial post is in fact the before of version 2
        if (discourseFirstPostRevision.version == 2)
          bodies.push({
            author_name:
              discourseFirstPostAuthor.name ??
              discourseFirstPostAuthor.username ??
              "Unknown",
            author_picture: discourseFirstPostAuthor.avatarTemplate,
          });

        bodies.push({
          author_name:
            discourseFirstPostAuthor.name ??
            discourseFirstPostAuthor.username ??
            "Unknown",
          author_picture: discourseFirstPostAuthor.avatarTemplate,
        });
      }
    }

    return bodies;
  });
}
