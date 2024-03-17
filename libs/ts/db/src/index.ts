import { DeduplicateJoinsPlugin, Kysely, MysqlDialect } from "kysely";
import type { DB } from "./kysely_db";
import { CamelCasePlugin } from "kysely";
import { createPool } from "mysql2";
import { config as dotenv_config } from "dotenv";

dotenv_config();

const db = new Kysely<DB>({
  dialect: new MysqlDialect({
    pool: createPool(process.env.DATABASE_URL!),
  }),
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});

export { db };
export * from "./kysely_db";
export * from "./enums";
export { Kysely };
export { jsonArrayFrom } from "kysely/helpers/mysql";
