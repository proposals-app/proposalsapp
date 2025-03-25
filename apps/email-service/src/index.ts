import { config as dotenvConfig } from "dotenv";
import express from "express";

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

export {};
