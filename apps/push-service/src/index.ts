import { config as dotenv_config } from "dotenv";
import express from "express";
import axios from "axios";
import webPush from "web-push";
import {
  db,
  NotificationDispatchStatusEnum,
  NotificationTypeEnum,
} from "@proposalsapp/db";

dotenv_config();

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
        ? NotificationTypeEnum.PUSHQUORUMNOTREACHED
        : NotificationTypeEnum.PUSHTIMEEND;

      // Check if a notification has already been sent
      const existingNotification = await db
        .selectFrom("notification")
        .where("userId", "=", user.id)
        .where("proposalId", "=", proposal.id)
        .where("type", "=", notificationType)
        .where("dispatchStatus", "=", NotificationDispatchStatusEnum.DISPATCHED)
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
          job: message,
          jobType: notificationType,
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
      .where("processed", "=", false)
      .where("jobType", "in", [
        NotificationTypeEnum.PUSHTIMEEND,
        NotificationTypeEnum.PUSHQUORUMNOTREACHED,
      ])
      .execute();

    for (const job of jobs) {
      const message = job.job as {
        userId: string;
        proposalId: string;
      };
      try {
        await sendPushNotification(
          message.userId,
          message.proposalId,
          job.jobType as NotificationTypeEnum,
        );
        await db
          .updateTable("jobQueue")
          .set({ processed: true })
          .where("id", "=", job.id)
          .execute();
      } catch (e) {
        console.log(e);
      }
    }
  } catch (err) {
    console.error("Error processing job queue:", err);
  }
};

const sendPushNotification = async (
  userId: string,
  proposalId: string,
  notificationType: NotificationTypeEnum,
) => {
  console.log(notificationType);
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
    notificationType === NotificationTypeEnum.PUSHQUORUMNOTREACHED
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
        await db
          .insertInto("notification")
          .values({
            userId,
            proposalId,
            type: notificationType,
            dispatchStatus: NotificationDispatchStatusEnum.DISPATCHED,
            dispatchedAt: new Date(),
          })
          .execute();
        console.log(`Sent push notification for ${proposalId} to ${userId}`);
      }
    } catch (e) {
      console.log(e);
    }
  }
};

setInterval(checkProposalsAndCreateJobs, 60 * 1000);
setInterval(processJobQueue, 10 * 1000);

module.exports = {};
