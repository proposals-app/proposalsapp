import cron from "node-cron";
import { config as dotenvConfig } from "dotenv";
import express from "express";
import { db, NotificationTypeEnumV2 } from "@proposalsapp/db";
import axios from "axios";
import { sendBulletin } from "./send_bulletin";
import { sendQuorum } from "./send_quorum";
import { sendTimeend } from "./send_timeend";

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
    await axios.get(`${process.env.ONEUPTIME_KEY}`);
    console.log("Uptime ping sent successfully");
  } catch (error) {
    console.error("Failed to send uptime ping:", error);
  }
}

setInterval(sendUptimePing, 10 * 1000);

export type JobData = {
  userId: string;
  proposalId?: string;
};
type SendFunction = (job: JobData) => Promise<void>;

async function processJobQueue(
  jobType: NotificationTypeEnumV2,
  sendFunction: SendFunction,
) {
  try {
    const jobs = await db
      .selectFrom("jobQueue")
      .selectAll()
      .where("processed", "=", false)
      .where("jobType", "=", jobType)
      .execute();

    for (const job of jobs) {
      try {
        await sendFunction(job.job as JobData);
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
    console.error(`Error processing ${jobType} job queue:`, err);
  }
}

const typedSendBulletin: SendFunction = sendBulletin;
const typedSendQuorum: SendFunction = sendQuorum;
const typedSendTimeend: SendFunction = sendTimeend;

// Process job queues every minute
cron.schedule("* * * * *", async () => {
  await processJobQueue(
    NotificationTypeEnumV2.EMAILBULLETIN,
    typedSendBulletin,
  );
  await processJobQueue(
    NotificationTypeEnumV2.EMAILQUORUMNOTREACHED,
    typedSendQuorum,
  );
  await processJobQueue(NotificationTypeEnumV2.EMAILTIMEEND, typedSendTimeend);
});

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
          job: { userId: user.id },
          jobType: NotificationTypeEnumV2.EMAILBULLETIN,
        })
        .execute();
    }
  } catch (err) {
    console.error("Error in scheduled bulletin task:", err);
  }
});

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
//               job: { userId: user.id, proposalId: proposal.id },
//               jobType: NotificationTypeEnumV2.EMAILQUORUMNOTREACHED,
//             })
//             .execute();
//         }

//         if (user.emailTimeendWarning) {
//           await db
//             .insertInto("jobQueue")
//             .values({
//               job: { userId: user.id, proposalId: proposal.id },
//               jobType: NotificationTypeEnumV2.EMAILTIMEEND,
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
