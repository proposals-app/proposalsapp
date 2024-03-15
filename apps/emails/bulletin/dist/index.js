"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const dotenv_1 = require("dotenv");
const node_cron_1 = __importDefault(require("node-cron"));
const rsmq_1 = __importDefault(require("rsmq"));
const db_1 = __importDefault(require("@proposalsapp/db"));
const rsmq_worker_1 = __importDefault(require("rsmq-worker"));
const QUEUE_NAME = "email:bulletin";
let redis;
let rsmq;
let worker;
(0, dotenv_1.config)();
node_cron_1.default.schedule("* * * * *", async () => {
    if (!redis || !rsmq) {
        redis = await (0, redis_1.createClient)({ url: process.env.REDIS_URL })
            .on("error", (err) => console.log("Redis Client Error", err))
            .connect();
        rsmq = new rsmq_1.default({ client: redis });
        worker = new rsmq_worker_1.default(QUEUE_NAME, { rsmq: rsmq });
    }
    rsmq
        .createQueueAsync({ qname: QUEUE_NAME })
        .catch(() => console.log("could not create queue"));
    const users = await db_1.default
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
