import { config as dotenv_config } from "dotenv";

dotenv_config();

export const baseUrl = process.env.WEB_URL ?? "https://proposals.app";
