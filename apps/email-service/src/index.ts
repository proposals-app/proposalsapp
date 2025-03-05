import cron from "node-cron";
import { config as dotenvConfig } from "dotenv";
import express from "express";
import { db } from "@proposalsapp/db-indexer";
import axios from "axios";

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
    await axios.get(`${process.env.BETTERSTACK_KEY}`);
    console.log("Uptime ping sent successfully");
  } catch (error) {
    console.error("Failed to send uptime ping:", error);
  }
}

setInterval(sendUptimePing, 10 * 1000);

async function processJobQueue() {
  try {
    const jobs = await db
      .selectFrom("jobQueue")
      .selectAll()
      .where("status", "=", "PENDING")
      .where("type", "in", [
        "EMAIL_BULLETIN",
        "EMAIL_QUORUM_NOT_REACHED",
        "EMAIL_TIMEEND",
      ])
      .execute();

    for (const job of jobs) {
      try {
        switch (job.type) {
          case "EMAIL_BULLETIN":
            break;
          default:
            console.log(`Unknown job type: ${job.type}`);
        }
        await db
          .updateTable("jobQueue")
          .set({ status: "COMPLETED" })
          .where("id", "=", job.id)
          .execute();
      } catch (e) {
        console.error(`Failed to process job ${job.id}:`, e);
        await db
          .updateTable("jobQueue")
          .set({ status: "FAILED" })
          .where("id", "=", job.id)
          .execute();
      }
    }
  } catch (err) {
    console.error("Error processing job queue:", err);
  }
}

// Process job queues every minute
cron.schedule("* * * * *", processJobQueue);

export {};
