import { db } from "@proposalsapp/db";
import { config as dotenv_config } from "dotenv";
import express from "express";
import cron from "node-cron";
import { sendQuorum } from "./send_quorum";

const JOB_TYPE = "email-quorum";

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
        await sendQuorum(message.userId, message.proposalId);
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
    .where((eb) => eb("quorum", ">", eb.ref("scoresQuorum")))
    .selectAll()
    .execute();

  const daos = proposals.map((p) => p.daoId);

  const users = await db
    .selectFrom("user")
    .innerJoin("userSettings", "userSettings.userId", "user.id")
    .innerJoin("subscription", "subscription.userId", "user.id")
    .where("emailVerified", "=", true)
    .where("emailQuorumWarning", "=", true)
    .where("subscription.daoId", "in", daos)
    .select("user.id")
    .distinct()
    .execute();

  console.log(`${proposals.length} proposals for ${users.length} users`);

  if (proposals.length == 0) return;

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
