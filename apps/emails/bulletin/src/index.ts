import cron from "node-cron";
import amqplib from "amqplib";
import { config as dotenv_config } from "dotenv";
import { sendBulletin } from "./send_bulletin";
import express from "express";
import { db } from "@proposalsapp/db";

const QUEUE_NAME = "email:bulletin";

type Message = {
  userId: string;
};

dotenv_config();

let rbmq_conn: amqplib.Connection | undefined;
let rbmq_ch: amqplib.Channel | undefined;

async function setupQueue() {
  rbmq_conn = await amqplib.connect(process.env.RABBITMQ_URL!);
  rbmq_ch = await rbmq_conn.createChannel();
  await rbmq_ch.assertQueue(QUEUE_NAME);

  rbmq_ch.consume(QUEUE_NAME, async (msg) => {
    if (msg !== null) {
      const message = JSON.parse(msg.content.toString()) as Message;

      await sendBulletin(message.userId)
        .then(() => rbmq_ch!.ack(msg))
        .catch((e) => {
          console.log(e);
          rbmq_ch!.nack(msg);
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

cron.schedule("0 8 * * *", async () => {
  const users = await db
    .selectFrom("user")
    .innerJoin("userSettings", "userSettings.userId", "user.id")
    .innerJoin("subscription", "subscription.userId", "user.id")
    .where("emailVerified", "=", true)
    .where("emailDailyBulletin", "=", true)
    .select("user.id")
    .distinct()
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
