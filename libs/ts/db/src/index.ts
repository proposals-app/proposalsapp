import { DeduplicateJoinsPlugin, Kysely, PostgresDialect } from "kysely";
import { CamelCasePlugin } from "kysely";
import { config as dotenv_config } from "dotenv";
import { DB } from "./kysely_db";
import { Pool } from "pg";

dotenv_config();

const db_pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: db_pool,
  }),
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});

export { db_pool };
export { db };
export * from "./kysely_db";
export { Kysely };
export { jsonArrayFrom } from "kysely/helpers/postgres";
