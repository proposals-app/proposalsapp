import {
  DeduplicateJoinsPlugin,
  ExpressionBuilder,
  Kysely,
  ParseJSONResultsPlugin,
  PostgresDialect,
  sql,
  StringReference,
} from "kysely";
import { CamelCasePlugin } from "kysely";
import { config as dotenv_config } from "dotenv";
import { DB } from "./kysely_db";
import pg from "pg";

dotenv_config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not defined.");
}

const { Pool } = pg;

const db_pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 5,
  max: 10,
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
  var dbIndexer: Kysely<DB> | undefined;
}

export const dbIndexer = global.dbIndexer || createDbInstance();

//if (process.env.NODE_ENV !== "production") global.db = db;

function traverseJSON<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  column: StringReference<DB, TB>,
  path: string | [string, ...string[]],
) {
  if (!Array.isArray(path)) {
    path = [path];
  }

  return sql`${sql.ref(column)}->${sql.raw(
    path.map((item) => `'${item}'`).join("->"),
  )}`;
}

export { traverseJSON };
export { db_pool };
export * from "./kysely_db";
export { Kysely };
export { sql, type Selectable, type Insertable } from "kysely";
export { jsonArrayFrom } from "kysely/helpers/postgres";
export { type SelectQueryBuilder } from "kysely";
