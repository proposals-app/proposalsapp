import express from "express";
import { config } from "dotenv";
import cron from "node-cron";
import { dbIndexer } from "@proposalsapp/db-indexer";
import { dbWeb } from "@proposalsapp/db-web";
import {
  NewProposalEmailTemplate,
  NewDiscussionEmailTemplate,
  EndingProposalEmailTemplate,
  resend,
} from "@proposalsapp/emails";
import axios from "axios";

config();

const app = express();
const port = process.env.PORT || 3002;

// Health check endpoint
app.get("/health", (req, res) => {
  res.send("OK");
});

async function checkNewProposals() {
  try {
    // Check for new proposals
    const newProposals = await dbIndexer
      .selectFrom("proposal")
      .selectAll()
      .where("createdAt", ">", new Date(Date.now() - 60 * 1000))
      .execute();

    for (const proposal of newProposals) {
      // Check if proposal is part of a group
      const proposalGroups = await dbIndexer
        .selectFrom("proposalGroup")
        .selectAll()
        .where("daoId", "=", proposal.daoId)
        .execute();

      let groupId: string | undefined;
      for (const group of proposalGroups) {
        const items = group.items as any[];
        const isInGroup = items.some(
          (item) =>
            item.type === "proposal" &&
            item.externalId === proposal.externalId &&
            item.governorId === proposal.governorId,
        );
        if (isInGroup) {
          groupId = group.id;
          break;
        }
      }

      // If not in a group yet, wait for the next iteration
      if (!groupId) {
        console.log(
          `Proposal ${proposal.id} is not part of a group yet, waiting for next iteration`,
        );
        continue;
      }

      // Get the author information from the voter table

      const author = await dbIndexer
        .selectFrom("voter")
        .selectAll()
        .where("address", "=", proposal.author)
        .executeTakeFirst();

      // Get users who have enabled new proposal notifications
      const users = await dbWeb
        .selectFrom("user")
        .select(["id", "email"])
        .where("emailSettingsNewProposals", "=", true)
        .execute();

      // Get the DAO name and slug
      const dao = await dbIndexer
        .selectFrom("dao")
        .selectAll()
        .where("id", "=", proposal.daoId)
        .executeTakeFirst();

      if (!dao) {
        console.error(`DAO not found for proposal ${proposal.id}`);
        continue;
      }

      for (const user of users) {
        if (!user.email) continue;

        // Check if notification already sent
        const existingNotification = await dbWeb
          .selectFrom("userNotification")
          .selectAll()
          .where((eb) =>
            eb.and([
              eb("userId", "=", user.id),
              eb("type", "=", "EMAIL_NEW_PROPOSAL"),
              eb("targetId", "=", proposal.id),
            ]),
          )
          .executeTakeFirst();

        if (existingNotification) continue;

        try {
          const { error } = await resend.emails.send({
            from: "Proposals.app <notifications@proposals.app>",
            to: [user.email],
            subject: `New proposal in ${dao.name}`,
            react: NewProposalEmailTemplate({
              proposalName: proposal.name,
              proposalUrl: `https://${dao.slug}.proposals.app/${groupId}`,
              daoName: dao.name,
              authorAddress: author?.address ?? "",
              authorEns: author?.ens ?? "",
            }),
          });

          if (error) {
            console.error(
              `Failed to send new proposal email to ${user.email}:`,
              error,
            );
            continue;
          }

          // Record notification
          await dbWeb
            .insertInto("userNotification")
            .values({
              userId: user.id,
              type: "EMAIL_NEW_PROPOSAL",
              targetId: proposal.id,
              sentAt: new Date(),
            })
            .execute();
        } catch (error) {
          console.error(
            `Failed to send new proposal email to ${user.email}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("Error checking new proposals:", error);
  }
}

async function checkNewDiscussions() {
  try {
    // Get discussions created in the last minute
    const newDiscussions = await dbIndexer
      .selectFrom("discourseTopic")
      .selectAll()
      .where("createdAt", ">=", new Date(Date.now() - 60 * 1000))
      .execute();

    for (const discussion of newDiscussions) {
      // Check if discussion is part of a group
      const daoDiscourse = await dbIndexer
        .selectFrom("daoDiscourse")
        .selectAll()
        .where("id", "=", discussion.daoDiscourseId)
        .executeTakeFirst();

      if (!daoDiscourse) {
        console.error(
          `DAO discourse not found for discussion ${discussion.id}`,
        );
        continue;
      }

      // Get the first post of the discussion to get the author
      const firstPost = await dbIndexer
        .selectFrom("discoursePost")
        .selectAll()
        .where("topicId", "=", discussion.externalId)
        .where("daoDiscourseId", "=", discussion.daoDiscourseId)
        .where("postNumber", "=", 1)
        .executeTakeFirst();

      if (!firstPost) {
        console.error(`First post not found for discussion ${discussion.id}`);
        continue;
      }

      // Get the author information from Discourse
      const discourseUser = await dbIndexer
        .selectFrom("discourseUser")
        .selectAll()
        .where("externalId", "=", firstPost.userId)
        .where("daoDiscourseId", "=", discussion.daoDiscourseId)
        .executeTakeFirst();

      if (!discourseUser) {
        console.error(
          `Discourse user not found for discussion ${discussion.id}`,
        );
        continue;
      }

      const proposalGroups = await dbIndexer
        .selectFrom("proposalGroup")
        .selectAll()
        .where("daoId", "=", daoDiscourse.daoId)
        .execute();

      let groupId: string | undefined;
      for (const group of proposalGroups) {
        const items = group.items as any[];
        const isInGroup = items.some(
          (item) =>
            item.type === "topic" &&
            item.externalId === discussion.externalId.toString() &&
            item.daoDiscourseId === discussion.daoDiscourseId,
        );
        if (isInGroup) {
          groupId = group.id;
          break;
        }
      }

      // If not in a group yet, wait for the next iteration
      if (!groupId) {
        console.log(
          `Discussion ${discussion.id} is not part of a group yet, waiting for next iteration`,
        );
        continue;
      }

      // Get the DAO name
      const dao = await dbIndexer
        .selectFrom("dao")
        .selectAll()
        .where("id", "=", daoDiscourse.daoId)
        .executeTakeFirst();

      if (!dao) {
        console.error(`DAO not found for discussion ${discussion.id}`);
        continue;
      }

      // Get users who have enabled new discussion notifications
      const users = await dbWeb
        .selectFrom("user")
        .select(["id", "email"])
        .where("emailSettingsNewDiscussions", "=", true)
        .execute();

      for (const user of users) {
        if (!user.email) continue;

        // Check if notification was already sent
        const existingNotification = await dbWeb
          .selectFrom("userNotification")
          .selectAll()
          .where("userId", "=", user.id)
          .where("type", "=", "EMAIL_NEW_DISCUSSION")
          .where("targetId", "=", discussion.id)
          .executeTakeFirst();

        if (existingNotification) {
          continue;
        }

        try {
          const { error } = await resend.emails.send({
            from: "Proposals.app <notifications@proposals.app>",
            to: [user.email],
            subject: `New Discussion in ${dao.name}`,
            react: NewDiscussionEmailTemplate({
              discussionTitle: discussion.title || "New Discussion",
              discussionUrl: `https://${dao.slug}.proposals.app/${groupId}`,
              daoName: dao.name,
              authorUsername: discourseUser.username,
              authorProfilePicture: discourseUser.avatarTemplate,
            }),
          });

          if (error) {
            console.error(
              `Failed to send new discussion email to ${user.email}:`,
              error,
            );
            continue;
          }

          // Record notification
          await dbWeb
            .insertInto("userNotification")
            .values({
              userId: user.id,
              type: "EMAIL_NEW_DISCUSSION",
              targetId: discussion.id,
              sentAt: new Date(),
            })
            .execute();
        } catch (error) {
          console.error(
            `Failed to send new discussion email to ${user.email}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("Error in checkNewDiscussions:", error);
  }
}

async function checkEndingProposals() {
  try {
    // Check for ending proposals
    const endingProposals = await dbIndexer
      .selectFrom("proposal")
      .selectAll()
      .where((eb) =>
        eb.and([
          eb("endAt", ">", new Date(Date.now() + 23 * 60 * 60 * 1000)),
          eb("endAt", "<", new Date(Date.now() + 25 * 60 * 60 * 1000)),
        ]),
      )
      .execute();

    for (const proposal of endingProposals) {
      // Check if proposal is part of a group
      const proposalGroups = await dbIndexer
        .selectFrom("proposalGroup")
        .selectAll()
        .where("daoId", "=", proposal.daoId)
        .execute();

      let groupId: string | undefined;
      for (const group of proposalGroups) {
        const items = group.items as any[];
        const isInGroup = items.some(
          (item) =>
            item.type === "proposal" &&
            item.externalId === proposal.externalId &&
            item.governorId === proposal.governorId,
        );
        if (isInGroup) {
          groupId = group.id;
          break;
        }
      }

      // If not in a group yet, wait for the next iteration
      if (!groupId) {
        console.log(
          `Proposal ${proposal.id} is not part of a group yet, waiting for next iteration`,
        );
        continue;
      }

      // Get users who have enabled ending proposal notifications
      const users = await dbWeb
        .selectFrom("user")
        .select(["id", "email"])
        .where("emailSettingsEndingProposals", "=", true)
        .execute();

      // Get the DAO name
      const dao = await dbIndexer
        .selectFrom("dao")
        .selectAll()
        .where("id", "=", proposal.daoId)
        .executeTakeFirst();

      if (!dao) {
        console.error(`DAO not found for proposal ${proposal.id}`);
        continue;
      }

      for (const user of users) {
        if (!user.email) continue;

        // Check if notification already sent
        const existingNotification = await dbWeb
          .selectFrom("userNotification")
          .selectAll()
          .where((eb) =>
            eb.and([
              eb("userId", "=", user.id),
              eb("type", "=", "EMAIL_ENDING_PROPOSAL"),
              eb("targetId", "=", proposal.id),
            ]),
          )
          .executeTakeFirst();

        if (existingNotification) continue;

        try {
          const { error } = await resend.emails.send({
            from: "Proposals.app <notifications@proposals.app>",
            to: [user.email],
            subject: `Proposal ending soon in ${dao.name}`,
            react: EndingProposalEmailTemplate({
              proposalName: proposal.name,
              proposalUrl: `https://${dao.slug}.proposals.app/${groupId}`,
              daoName: dao.name,
              endTime: proposal.endAt.toISOString(),
            }),
          });

          if (error) {
            console.error(
              `Failed to send ending proposal email to ${user.email}:`,
              error,
            );
            continue;
          }

          // Record notification
          await dbWeb
            .insertInto("userNotification")
            .values({
              userId: user.id,
              type: "EMAIL_ENDING_PROPOSAL",
              targetId: proposal.id,
              sentAt: new Date(),
            })
            .execute();
        } catch (error) {
          console.error(
            `Failed to send ending proposal email to ${user.email}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("Error checking ending proposals:", error);
  }
}

// Schedule jobs
cron.schedule("* * * * *", async () => {
  try {
    await checkNewProposals();
    await checkNewDiscussions();
    await checkEndingProposals();
  } catch (error) {
    console.error("Error running scheduled jobs:", error);
  }
});

// Send uptime ping every 10 seconds
const sendUptimePing = async () => {
  try {
    await axios.get(`${process.env.BETTERSTACK_KEY}`);
  } catch (error) {
    console.error("Error sending uptime ping:", error);
  }
};

setInterval(sendUptimePing, 10 * 1000);

// Start server
app.listen(port, () => {
  console.log(`Email service listening on port ${port}`);
});

export {};
