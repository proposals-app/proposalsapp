import cron from "node-cron";
import { config as dotenvConfig } from "dotenv";
import express from "express";
import { db } from "@proposalsapp/db";
import axios from "axios";
import { sendBulletin } from "./send_bulletin";
import { sendQuorum } from "./send_quorum";
import { sendTimeend } from "./send_timeend";
import { sendDeprecationNotice } from "./send_deprecation_notice";

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
            // await sendBulletin(job.data);
            await sendDeprecationNotice(job.data);
            break;
          case "EMAIL_QUORUM_NOT_REACHED":
            await sendQuorum(job.data);
            break;
          case "EMAIL_TIMEEND":
            await sendTimeend(job.data);
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

// Schedule tasks to add jobs to the job queues
cron.schedule("0 8 * * *", async () => {
  // Add bulletin jobs
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
      await db
        .insertInto("jobQueue")
        .values({
          type: "EMAIL_BULLETIN",
          data: { userId: user.id },
          status: "PENDING",
        })
        .execute();
    }
  } catch (err) {
    console.error("Error in scheduled bulletin task:", err);
  }
});

// // Cron to add quorum and timeend jobs
// cron.schedule("* * * * *", async () => {
//   // Add quorum and timeend jobs
//   try {
//     const proposals = await db
//       .selectFrom("proposal")
//       .where("timeEnd", ">", new Date())
//       .where(
//         "timeEnd",
//         "<",
//         new Date(new Date().getTime() + 1 * 60 * 60 * 1000),
//       )
//       .selectAll()
//       .execute();

//     const daos = proposals.map((p) => p.daoId);

//     const users = await db
//       .selectFrom("user")
//       .innerJoin("userSettings", "userSettings.userId", "user.id")
//       .innerJoin("subscription", "subscription.userId", "user.id")
//       .where("emailVerified", "=", true)
//       .where((eb) =>
//         eb.or([
//           eb("emailQuorumWarning", "=", true),
//           eb("emailTimeendWarning", "=", true),
//         ]),
//       )
//       .where("subscription.daoId", "in", daos)
//       .select("user.id")
//       .select("userSettings.emailQuorumWarning")
//       .select("userSettings.emailTimeendWarning")
//       .distinct()
//       .execute();

//     for (const user of users) {
//       for (const proposal of proposals) {
//         if (
//           user.emailQuorumWarning &&
//           proposal.scoresQuorum < proposal.quorum
//         ) {
//           await db
//             .insertInto("jobQueue")
//             .values({
//               type: "EMAIL_QUORUM_NOT_REACHED",
//               data: { userId: user.id, proposalId: proposal.id },
//               status: "PENDING",
//             })
//             .execute();
//         }

//         if (user.emailTimeendWarning) {
//           await db
//             .insertInto("jobQueue")
//             .values({
//               type: "EMAIL_TIMEEND",
//               data: { userId: user.id, proposalId: proposal.id },
//               status: "PENDING",
//             })
//             .execute();
//         }
//       }
//     }
//   } catch (err) {
//     console.error("Error in scheduled quorum and timeend task:", err);
//   }
// });

export {};
