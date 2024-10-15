import {
  DeduplicateJoinsPlugin,
  Kysely,
  ParseJSONResultsPlugin,
  PostgresDialect,
} from "kysely";
import { CamelCasePlugin } from "kysely";
import { config as dotenv_config } from "dotenv";
import { DB } from "./kysely_db";
import pg from "pg";

dotenv_config();

const { Pool } = pg;

const db_pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const createDbInstance = () => {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: db_pool,
    }),
    plugins: [
      new CamelCasePlugin(),
      new DeduplicateJoinsPlugin(),
      new ParseJSONResultsPlugin(),
    ],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var db: Kysely<DB> | undefined;
}

export const db = global.db || createDbInstance();

//if (process.env.NODE_ENV !== "production") global.db = db;

export { db_pool };
export * from "./kysely_db";
export { Kysely };
export { sql, type Selectable, type Insertable } from "kysely";
export { jsonArrayFrom } from "kysely/helpers/postgres";
