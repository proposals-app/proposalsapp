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

if (!process.env.ARBITRUM_DATABASE_URL) {
  throw new Error("ARBITRUM_DATABASE_URL environment variable is not defined.");
}

const { Pool } = pg;

export const db_pool_public = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 5,
  max: 10,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db_pool_arbitrum = new Pool({
  connectionString: process.env.ARBITRUM_DATABASE_URL,
  min: 5,
  max: 10,
  ssl: {
    rejectUnauthorized: false,
  },
});

const createDbPublicInstance = () => {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: db_pool_public,
    }),
    plugins: [
      new CamelCasePlugin(),
      new DeduplicateJoinsPlugin(),
      new ParseJSONResultsPlugin(),
    ],
  });
};

const createDbArbitrumInstance = () => {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: db_pool_arbitrum,
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
  var dbPublicInternal: Kysely<DB> | undefined;
  // eslint-disable-next-line no-var
  var dbArbitrumInternal: Kysely<DB> | undefined;
}

const dbPublic = global.dbPublicInternal || createDbPublicInstance();
const dbArbitrum = global.dbArbitrumInternal || createDbArbitrumInstance();

export const dbPool = {
  public: db_pool_public,
  arbitrum: db_pool_arbitrum,
};

export const db = {
  public: dbPublic,
  arbitrum: dbArbitrum.withSchema("arbitrum"),
};

//if (process.env.NODE_ENV !== "production") global.dbPublic = dbPublic;
//if (process.env.NODE_ENV !== "production") global.dbArbitrum = dbArbitrum;

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
export * from "./kysely_db";
export { Kysely };
export { sql, type Selectable, type Insertable } from "kysely";
export { jsonArrayFrom } from "kysely/helpers/postgres";
export { type SelectQueryBuilder } from "kysely";
