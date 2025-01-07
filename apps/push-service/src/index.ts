import { config as dotenvConfig } from "dotenv";
import express from "express";
import axios from "axios";
import webPush from "web-push";
import { db, traverseJSON } from "@proposalsapp/db";

dotenvConfig();

const app = express();
app.get("/", (_req, res) => {
  res.send("OK");
});
app.listen(3000, () =>
  console.log(`Healthcheck is running at http://localhost:3000`),
);

const sendUptimePing = async () => {
  try {
    await axios.get(`${process.env.BETTERSTACK_KEY}`);
    console.log("Uptime ping sent successfully");
  } catch (error) {
    console.error("Failed to send uptime ping:", error);
  }
};

setInterval(sendUptimePing, 10 * 1000);

const checkProposalsAndCreateJobs = async () => {
  const proposals = await db
    .selectFrom("proposal")
    .selectAll()
    .where("timeEnd", ">", new Date())
    .where("timeEnd", "<", new Date(new Date().getTime() + 1 * 60 * 60 * 1000))
    .execute();

  const daos = proposals.map((p) => p.daoId);
  if (!proposals.length) return;
  if (!daos.length) return;

  const users = await db
    .selectFrom("user")
    .innerJoin("userSettings", "userSettings.userId", "user.id")
    .innerJoin("subscription", "subscription.userId", "user.id")
    .where("pushNotifications", "=", true)
    .where("subscription.daoId", "in", daos)
    .select("user.id")
    .distinct()
    .execute();

  console.log(`${proposals.length} proposals for ${users.length} users`);

  for (const user of users) {
    const voters = await db
      .selectFrom("voter")
      .innerJoin("userToVoter", "voter.id", "userToVoter.voterId")
      .where("userId", "=", user.id)
      .select("voter.address")
      .execute();

    for (const proposal of proposals) {
      const votes = await db
        .selectFrom("vote")
        .where("vote.proposalId", "=", proposal.id)
        .where("vote.voterAddress", "in", [
          "",
          ...voters.map((voter) => voter.address),
        ])
        .select("vote.id")
        .execute();

      if (votes.length > 0) continue;

      const quorumNotReached = proposal.quorum > proposal.scoresQuorum;
      const notificationType = quorumNotReached
        ? "PUSH_QUORUM_NOT_REACHED"
        : "PUSH_TIMEEND";

      // Check if a notification has already been sent
      const existingNotification = await db
        .selectFrom("jobQueue")
        .where((eb) =>
          eb.and([
            eb(traverseJSON(eb, "data", "userId"), "=", user.id),
            eb(traverseJSON(eb, "data", "proposalId"), "=", proposal.id),
          ]),
        )
        .where("type", "=", notificationType)
        .where("status", "=", "COMPLETED")
        .select("id")
        .executeTakeFirst();

      if (existingNotification) {
        console.log(
          `Notification already sent for user ${user.id} and proposal ${proposal.id}`,
        );
        continue;
      }

      const message = {
        userId: user.id,
        proposalId: proposal.id,
      };

      await db
        .insertInto("jobQueue")
        .values({
          type: notificationType,
          data: message,
          status: "PENDING",
        })
        .execute();
    }
  }
};

const processJobQueue = async () => {
  try {
    const jobs = await db
      .selectFrom("jobQueue")
      .selectAll()
      .where("status", "=", "PENDING")
      .where("type", "in", ["PUSH_QUORUM_NOT_REACHED", "PUSH_TIMEEND"])
      .execute();

    for (const job of jobs) {
      const message = job.data as {
        userId: string;
        proposalId: string;
      };
      try {
        switch (job.type) {
          case "PUSH_QUORUM_NOT_REACHED":
            await sendPushNotification(
              message.userId,
              message.proposalId,
              job.type,
            );
            break;
          case "PUSH_TIMEEND":
            await sendPushNotification(
              message.userId,
              message.proposalId,
              job.type,
            );
            break;
          default:
            console.log(`Unknown job type: ${job.type}`);
        }
        await db
          .updateTable("jobQueue")
          .set({ status: "COMPLETED" })
          .where("id", "=", job.id)
          .execute();
      } catch (e) {
        console.error(`Failed to process job ${job.id}:`, e);
        await db
          .updateTable("jobQueue")
          .set({ status: "FAILED" })
          .where("id", "=", job.id)
          .execute();
      }
    }
  } catch (err) {
    console.error("Error processing job queue:", err);
  }
};

const sendPushNotification = async (
  userId: string,
  proposalId: string,
  notificationType: string,
) => {
  const [userPushSubscriptions, dao] = await Promise.all([
    db
      .selectFrom("userPushNotificationSubscription")
      .select(["endpoint", "p256dh", "auth"])
      .where("userId", "=", userId)
      .execute(),

    db
      .selectFrom("dao")
      .where(
        "dao.id",
        "=",
        db.selectFrom("proposal").where("id", "=", proposalId).select("daoId"),
      )
      .selectAll()
      .executeTakeFirstOrThrow(),
  ]);

  webPush.setVapidDetails(
    `mailto:${process.env.WEB_PUSH_EMAIL}`,
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );

  const message =
    notificationType === "PUSH_QUORUM_NOT_REACHED"
      ? `${dao.name} proposal is nearing its deadline and hasn't reached quorum yet. Don't forget to cast your vote!`
      : `${dao.name} proposal is nearing its deadline and you didn't vote yet. Don't forget to cast your vote!`;

  for (const pushSubscription of userPushSubscriptions) {
    const subscription = {
      endpoint: pushSubscription.endpoint,
      keys: { p256dh: pushSubscription.p256dh, auth: pushSubscription.auth },
    };

    try {
      const result = await webPush.sendNotification(
        subscription,
        JSON.stringify({ title: "Your Vote is Needed!", message: message }),
      );

      if (result.statusCode == 201) {
        console.log(`Sent push notification for ${proposalId} to ${userId}`);
      }
    } catch (e) {
      console.error(
        `Failed to send push notification for ${proposalId} to ${userId}:`,
        e,
      );
    }
  }
};

setInterval(checkProposalsAndCreateJobs, 60 * 1000);
setInterval(processJobQueue, 10 * 1000);

module.exports = {};
