import cron from "node-cron";
import { config as dotenvConfig } from "dotenv";
import { sendBulletin } from "./send_bulletin";
import express from "express";
import { db } from "@proposalsapp/db";
import axios from "axios";

const JOB_TYPE = "email-bulletin";

type Message = {
  userId: string;
};

dotenvConfig();

const app = express();

app.get("/", (_req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log(`Healthcheck is running at http://localhost:3000`);
});

async function sendUptimePing() {
  try {
    await axios.get("https://uptime.proposals.app/api/push/GBfFgbgA62");
    console.log("Uptime ping sent successfully");
  } catch (error) {
    console.error("Failed to send uptime ping:", error);
  }
}

setInterval(sendUptimePing, 60000);

// Function to process jobs from the job queue
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
        await sendBulletin(message.userId);
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

// Schedule job queue processing every minute
cron.schedule("* * * * *", async () => {
  await processJobQueue();
});

// Schedule task to add jobs to the job queue
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

    for (const user of users) {
      const message: Message = { userId: user.id };
      await db
        .insertInto("jobQueue")
        .values({
          job: message,
          jobType: JOB_TYPE,
        })
        .execute();
    }
  } catch (err) {
    console.error("Error in scheduled task:", err);
  }
});

export {};
