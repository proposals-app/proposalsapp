import cron from "node-cron";
import amqplib from "amqplib";
import { DeduplicateJoinsPlugin, Kysely, MysqlDialect } from "kysely";
import { CamelCasePlugin } from "kysely";
import { createPool } from "mysql2";
import { config as dotenv_config } from "dotenv";
import { DB } from "@proposalsapp/db";
import { sendBulletin } from "./send_bulletin";
import express from "express";

const QUEUE_NAME = "email:bulletin";

type Message = {
  userId: string;
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

const app = express();

async function setupQueue() {
  rbmq_conn = await amqplib.connect(process.env.RABBITMQ_URL!);
  rbmq_ch = await rbmq_conn.createChannel();
  await rbmq_ch.assertQueue(QUEUE_NAME);

  rbmq_ch.consume(QUEUE_NAME, async (msg) => {
    if (msg !== null) {
      const message = JSON.parse(msg.content.toString()) as Message;

      await sendBulletin(message.userId)
        .then(() => rbmq_ch!.ack(msg))
        .catch(() => rbmq_ch!.nack(msg));
    }
  });
}

setupQueue().catch((err) => {
  console.error("Error setting up RabbitMQ:", err);
  process.exit(1);
});

app.get("/", (_req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log(`Healthcheck is running at http://localhost:3000`);
});

cron.schedule("0 8 * * *", async () => {
  const users = await db
    .selectFrom("user")
    .innerJoin("userSettings", "userSettings.userId", "user.id")
    .innerJoin("subscription", "subscription.userId", "user.id")
    .where("emailVerified", "=", 1)
    .where("emailDailyBulletin", "=", 1)
    .distinctOn("user.id")
    .select("user.id")
    .execute();

  for (const user of users) {
    const message: Message = {
      userId: user.id,
    };

    if (rbmq_ch)
      rbmq_ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));
  }
});

module.exports = {};
