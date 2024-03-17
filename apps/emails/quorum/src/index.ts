import cron from "node-cron";
import amqplib from "amqplib";
import { DeduplicateJoinsPlugin, Kysely, MysqlDialect } from "kysely";
import { CamelCasePlugin } from "kysely";
import { createPool } from "mysql2";
import { config as dotenv_config } from "dotenv";
import { DB } from "@proposalsapp/db";
import { sendQuorum } from "./send_quorum";
import express from "express";

const QUEUE_NAME = "email:quorum";

type Message = {
  userId: string;
  proposalId: string;
};

dotenv_config();

let rbmq_conn: amqplib.Connection | undefined;
let rbmq_ch: amqplib.Channel | undefined;

const dialect = new MysqlDialect({
  pool: createPool(process.env.DATABASE_URL!),
});

const db = new Kysely<DB>({
  dialect: dialect,
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});

async function setupQueue() {
  rbmq_conn = await amqplib.connect(process.env.RABBITMQ_URL!);
  rbmq_ch = await rbmq_conn.createChannel();
  await rbmq_ch.assertQueue(QUEUE_NAME);

  rbmq_ch.consume(QUEUE_NAME, async (msg) => {
    if (msg !== null) {
      const message = JSON.parse(msg.content.toString()) as Message;

      await sendQuorum(message.userId, message.proposalId)
        .then(() => rbmq_ch!.ack(msg))
        .catch(() => rbmq_ch!.nack(msg));
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
  const proposals = await db
    .selectFrom("proposal")
    .where("timeEnd", ">", new Date())
    .where("timeEnd", "<", new Date(new Date().getTime() + 1 * 60 * 60 * 1000))
    .selectAll()
    .execute();

  const proposalsNoQuorum = proposals.filter((p) => p.quorum > p.scoresTotal);
  const daosNoQuorum = proposals.map((p) => p.daoId);

  const users = await db
    .selectFrom("user")
    .innerJoin("userSettings", "userSettings.userId", "user.id")
    .innerJoin("subscription", "subscription.userId", "user.id")
    .where("emailVerified", "=", 1)
    .where("emailQuorumWarning", "=", 1)
    .where("subscription.daoId", "in", daosNoQuorum)
    .select("user.id")
    .distinct()
    .execute();

  console.log(
    `${proposalsNoQuorum.length} noquorum proposals for ${users.length} users`,
  );

  if (proposalsNoQuorum.length == 0) return;

  for (const user of users) {
    for (const proposalNoQuorum of proposalsNoQuorum) {
      const voters =
        (await db
          .selectFrom("voter")
          .fullJoin("userToVoter", "voter.id", "userToVoter.voterId")
          .where("userId", "=", user.id)
          .select("voter.address")
          .execute()) ?? [];

      const vote = await db
        .selectFrom("vote")
        .where("vote.proposalId", "=", proposalNoQuorum.id)
        .where(
          "vote.voterAddress",
          "in",
          voters.map((voter) => (voter.address ? voter.address : "")),
        )
        .selectAll()
        .execute();

      if (vote.length > 0) continue;

      const message: Message = {
        userId: user.id,
        proposalId: proposalNoQuorum.id,
      };

      if (rbmq_ch)
        rbmq_ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));
    }
  }
});

module.exports = {};
