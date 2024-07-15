import { db } from "@proposalsapp/db";
import amqplib from "amqplib";
import { config as dotenv_config } from "dotenv";
import express from "express";
import cron from "node-cron";
import { sendTimeend } from "./send_timeend";

const QUEUE_NAME = "push:timeend";

type Message = {
  userId: string;
  proposalId: string;
};

dotenv_config();

let rbmq_conn: amqplib.Connection | undefined;
let rbmq_ch: amqplib.Channel | undefined;

async function setupQueue() {
  rbmq_conn = await amqplib.connect(process.env.RABBITMQ_URL!);
  rbmq_ch = await rbmq_conn.createChannel();
  await rbmq_ch.assertQueue(QUEUE_NAME);
  //rbmq_ch.prefetch(5);

  rbmq_ch.consume(QUEUE_NAME, async (msg) => {
    if (msg !== null) {
      const message = JSON.parse(msg.content.toString()) as Message;

      await sendTimeend(message.userId, message.proposalId)
        .then(() => rbmq_ch!.ack(msg))
        .catch((e) => {
          rbmq_ch!.nack(msg);
          console.log(e);
        });
    }
  });
}

setupQueue()
  .then(() => console.log("RabbitMQ set up!"))
  .catch((err) => {
    console.error("Error setting up RabbitMQ:", err);
    process.exit(1);
  });

const app = express();

app.get("/", (_req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log(`Healthcheck is running at http://localhost:3000`);
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

      rbmq_ch!.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));
    }
  }
});

module.exports = {};
