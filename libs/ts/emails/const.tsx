import { config as dotenv_config } from "dotenv";

dotenv_config();

export const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "";
