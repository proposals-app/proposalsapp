import { createClient } from "redis";
import { config as dotenv_config } from "dotenv";
import cron from "node-cron";
import RedisSMQ from "rsmq";
import db from "@proposalsapp/db";
import RSMQWorker from "rsmq-worker";

const QUEUE_NAME = "email:bulletin";

let redis: ReturnType<typeof createClient> | undefined;
let rsmq: RedisSMQ | undefined;
let worker: RSMQWorker.Client | undefined;

dotenv_config();

cron.schedule("* * * * *", async () => {
  if (!redis || !rsmq) {
    redis = await createClient({ url: process.env.REDIS_URL! })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();

    rsmq = new RedisSMQ({ client: redis });
    worker = new RSMQWorker(QUEUE_NAME, { rsmq: rsmq });
  }

  rsmq
    .createQueueAsync({ qname: QUEUE_NAME })
    .catch(() => console.log("could not create queue"));

  const users = await db
    .selectFrom("user")
    .innerJoin("userSettings", "userSettings.userId", "user.id")
    .innerJoin("subscription", "subscription.userId", "user.id")
    .where("emailVerified", "=", 1)
    .where("emailDailyBulletin", "=", 1)
    .select("user.id")
    .execute();

  for (const user of users) {
    await rsmq.sendMessageAsync({
      qname: QUEUE_NAME,
      message: JSON.stringify({ userId: user.id }),
    });

    console.log({
      qname: QUEUE_NAME,
      message: JSON.stringify({ userId: user.id }),
    });
  }
});
