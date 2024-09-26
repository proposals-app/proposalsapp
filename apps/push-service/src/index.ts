import {
  db,
  NotificationDispatchedStateEnum,
  NotificationTypeEnumV2,
} from "@proposalsapp/db";
import { config as dotenv_config } from "dotenv";
import express from "express";
import cron from "node-cron";
import axios from "axios";
import webPush from "web-push";

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
    await axios.get(
      `https://oneuptime.com/heartbeat/${process.env.ONEUPTIME_KEY}`,
    );
    console.log("Uptime ping sent successfully");
  } catch (error) {
    console.error("Failed to send uptime ping:", error);
  }
};

//setInterval(sendUptimePing, 10 * 1000);

const processJobQueue = async () => {
  try {
    const jobs = await db
      .selectFrom("jobQueue")
      .selectAll()
      .where("processed", "=", false)
      .where("jobType", "in", [
        NotificationTypeEnumV2.PUSHTIMEEND,
        NotificationTypeEnumV2.PUSHQUORUMNOTREACHED,
      ])
      .execute();

    for (const job of jobs) {
      const message = job.job as {
        userId: string;
        proposalId: string;
        type: NotificationTypeEnumV2;
      };
      try {
        await sendPushNotification(
          message.userId,
          message.proposalId,
          message.type,
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

const checkProposalsAndCreateJobs = async () => {
  const proposals = await db
    .selectFrom("proposal")
    .selectAll()
    .where("timeEnd", ">", new Date())
    .where("timeEnd", "<", new Date(new Date().getTime() + 1 * 60 * 60 * 1000))
    .execute();

  const daos = proposals.map((p) => p.daoId);
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

  if (proposals.length == 0) return;
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
      const message = {
        userId: user.id,
        proposalId: proposal.id,
      };

      await db
        .insertInto("jobQueue")
        .values({
          job: message,
          jobType: quorumNotReached
            ? NotificationTypeEnumV2.PUSHQUORUMNOTREACHED
            : NotificationTypeEnumV2.PUSHTIMEEND,
        })
        .execute();
    }
  }
};

const sendPushNotification = async (
  userId: string,
  proposalId: string,
  notificationType: NotificationTypeEnumV2,
) => {
  const existingNotification = await db
    .selectFrom("notification")
    .where("userId", "=", userId)
    .where("proposalId", "=", proposalId)
    .where("notification.type", "=", notificationType)
    .where(
      "notification.dispatchstatus",
      "=",
      NotificationDispatchedStateEnum.DISPATCHED,
    )
    .selectAll()
    .executeTakeFirst();

  if (existingNotification) return;

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
      .innerJoin("daoSettings", "daoSettings.daoId", "dao.id")
      .selectAll()
      .executeTakeFirstOrThrow(),
  ]);

  webPush.setVapidDetails(
    `mailto:${process.env.WEB_PUSH_EMAIL}`,
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );

  const message =
    notificationType === NotificationTypeEnumV2.PUSHQUORUMNOTREACHED
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

      if (result.statusCode === 201) {
        await db
          .insertInto("notification")
          .values({
            userId,
            proposalId,
            type: notificationType,
            dispatchstatus: NotificationDispatchedStateEnum.DISPATCHED,
            submittedAt: new Date(),
          })
          .execute();
      }
    } catch (e) {
      console.log(e);
    }
  }

  console.log(`send push notification for ${proposalId} to ${userId}`);
};

cron.schedule("* * * * *", processJobQueue);
cron.schedule("* * * * *", checkProposalsAndCreateJobs);

module.exports = {};
