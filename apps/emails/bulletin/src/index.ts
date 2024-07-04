import cron from "node-cron";
import amqplib from "amqplib";
import { config as dotenvConfig } from "dotenv";
import { sendBulletin } from "./send_bulletin";
import express from "express";
import { db } from "@proposalsapp/db";

const QUEUE_NAME = "email:bulletin";

type Message = {
  userId: string;
};

dotenvConfig();

let rbmqConn: amqplib.Connection | undefined;
let rbmqCh: amqplib.Channel | undefined;

async function setupQueue() {
  try {
    rbmqConn = await amqplib.connect(process.env.RABBITMQ_URL!);
    rbmqCh = await rbmqConn.createChannel();
    await rbmqCh.assertQueue(QUEUE_NAME);

    rbmqCh.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const message = JSON.parse(msg.content.toString()) as Message;

        try {
          await sendBulletin(message.userId);
          rbmqCh!.ack(msg);
        } catch (e) {
          console.log(e);
          rbmqCh!.nack(msg);
        }
      }
    });

    console.log("RabbitMQ set up!");
  } catch (err) {
    console.error("Error setting up RabbitMQ:", err);
    process.exit(1);
  }
}

setupQueue();

const app = express();

app.get("/", (_req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log(`Healthcheck is running at http://localhost:3000`);
});

cron.schedule("0 8 * * *", async () => {
  try {
    const users = await db
      .selectFrom("user")
      .innerJoin("userSettings", "userSettings.userId", "user.id")
      .innerJoin("subscription", "subscription.userId", "user.id")
      .where("emailVerified", "=", true)
      .where("emailDailyBulletin", "=", true)
      .select("user.id")
      .distinct()
      .execute();

    users.forEach((user) => {
      const message: Message = { userId: user.id };
      rbmqCh?.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));
    });
  } catch (err) {
    console.error("Error in scheduled task:", err);
  }
});

export {};
