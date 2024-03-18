import { db } from "@proposalsapp/db";
import axios from "axios";
import moment from "moment";
import { config as dotenv_config } from "dotenv";

export async function getCountdown(timeEnd: Date) {
  dotenv_config();

  const existing = await db
    .selectFrom("countdownCache")
    .where("time", "=", timeEnd)
    .selectAll()
    .executeTakeFirst();

  if (existing) {
    return {
      countdownSmall: existing.smallUrl,
      countdownLarge: existing.largeUrl,
    };
  }

  const endTimeString = moment(timeEnd).format("YYYY-MM-DD HH:mm:ss");

  const responseSmall = await axios({
    url: "https://countdownmail.com/api/create",
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "null",
      Authorization: process.env.COUNTDOWN_EMAIL_TOKEN,
    },
    data: {
      skin_id: 6,
      name: "proposal timer small",
      time_end: endTimeString,
      time_zone: "UTC",
      font_family: "Roboto-Medium",
      label_font_family: "RobotoCondensed-Light",
      color_primary: "000000",
      color_text: "000000",
      color_bg: "FFFFFF",
      transparent: "0",
      font_size: 14,
      label_font_size: 4,
      expired_mes_on: 1,
      expired_mes: "Proposal Ended",
      day: "1",
      days: "days",
      hours: "hours",
      minutes: "minutes",
      advanced_params: {
        separator_color: "FFFFFF",
        labels_color: "000000",
      },
    },
  })
    .then((r) => r.data.message.src as string)
    .catch((e) => {
      console.log(e);
      return "unknown";
    });

  const responseLarge = await axios({
    url: "https://countdownmail.com/api/create",
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "null",
      Authorization: process.env.COUNTDOWN_EMAIL_TOKEN,
    },
    data: {
      skin_id: 6,
      name: "proposal timer small",
      time_end: endTimeString,
      time_zone: "UTC",
      font_family: "RobotoCondensed-Light",
      label_font_family: "Roboto-Regular",
      color_primary: "000000",
      color_text: "000000",
      color_bg: "FFFFFF",
      transparent: "0",
      font_size: 24,
      label_font_size: 8,
      expired_mes_on: 1,
      expired_mes: "Proposal Ended",
      day: "1",
      days: "days",
      hours: "hours",
      minutes: "minutes",
      advanced_params: {
        separator_color: "FFFFFF",
        labels_color: "000000",
      },
    },
  })
    .then((r) => r.data.message.src as string)
    .catch((e) => {
      console.log(e);
      return "unknown";
    });

  await db
    .insertInto("countdownCache")
    .values({
      time: timeEnd,
      smallUrl: responseSmall,
      largeUrl: responseLarge,
    })
    .execute();

  return {
    countdownSmall: responseSmall,
    countdownLarge: responseLarge,
  };
}
