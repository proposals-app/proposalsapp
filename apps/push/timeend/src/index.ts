import { db } from "@proposalsapp/db";
import { config as dotenv_config } from "dotenv";
import express from "express";
import cron from "node-cron";
import { sendTimeend } from "./send_timeend";
import axios from "axios";

const JOB_TYPE = "push-timeend";

type Message = {
  userId: string;
  proposalId: string;
};

dotenv_config();

const app = express();

app.get("/", (_req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log(`Healthcheck is running at http://localhost:3000`);
});

async function sendUptimePing() {
  try {
    await axios.get("https://uptime.proposals.app/api/push/WamAgspiAq");
    console.log("Uptime ping sent successfully");
  } catch (error) {
    console.error("Failed to send uptime ping:", error);
  }
}

setInterval(sendUptimePing, 60000);

async function processJobQueue() {
  try {
    const jobs = await db
      .selectFrom("jobQueue")
      .selectAll()
      .where("processed", "=", false)
      .where("jobType", "=", JOB_TYPE)
      .execute();

    for (const job of jobs) {
      const message = job.job as Message;
      try {
        await sendTimeend(message.userId, message.proposalId);
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
}

cron.schedule("* * * * *", async () => {
  await processJobQueue();
});

cron.schedule("* * * * *", async () => {
  console.log("running cron");

  const proposals = await db
    .selectFrom("proposal")
    .where("timeEnd", ">", new Date())
    .where("timeEnd", "<", new Date(new Date().getTime() + 1 * 60 * 60 * 1000))
    .selectAll()
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
        .select("vote.id")
        .where("vote.proposalId", "=", proposal.id)
        .where("vote.voterAddress", "in", [
          "",
          ...voters.map((voter) => voter.address),
        ])
        .execute();

      if (votes.length > 0) continue;

      const message: Message = {
        userId: user.id,
        proposalId: proposal.id,
      };

      console.log({ message });

      await db
        .insertInto("jobQueue")
        .values({
          job: message,
          jobType: JOB_TYPE,
        })
        .execute();
    }
  }
});

module.exports = {};
