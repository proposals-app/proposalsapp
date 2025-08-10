import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  ParseJSONResultsPlugin,
  PostgresDialect,
  sql,
  type ExpressionBuilder,
  type StringReference,
} from 'kysely';
import { config as dotenv_config } from 'dotenv';
import type { DB } from './kysely_db';
import type { MaterializedViews } from './materialized-views';
import pg from 'pg';

dotenv_config();

// Check if we're in build phase - if so, use dummy values
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

// Only validate environment variables if not in build phase
if (!isBuildPhase) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }
}

const { Pool } = pg;

// Use dummy connection strings during build phase
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build';

export const db_pool_public = new Pool({
  connectionString: DATABASE_URL,
  min: 5,
  max: 10,
});

// Extend DB type with materialized views
type ExtendedDB = DB & MaterializedViews;

const createDbInstance = () => {
  return new Kysely<ExtendedDB>({
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

declare global {
  var dbInternal: Kysely<ExtendedDB> | undefined;
}

const dbInstance = global.dbInternal || createDbInstance();

export const dbPool = db_pool_public;

// Export the single database instance
export const db = dbInstance;

//if (process.env.NODE_ENV !== "production") global.dbPublic = dbPublic;
//if (process.env.NODE_ENV !== "production") global.dbArbitrum = dbArbitrum;
//if (process.env.NODE_ENV !== "production") global.dbUniswap = dbUniswap;

function traverseJSON<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  column: StringReference<DB, TB>,
  path: string | [string, ...string[]]
) {
  if (!Array.isArray(path)) {
    path = [path];
  }

  return sql`${sql.ref(column)}->${sql.raw(
    path.map((item) => `'${item}'`).join('->')
  )}`;
}

export { traverseJSON };
export * from './kysely_db';
export { Kysely };
export {
  sql,
  type Selectable,
  type Insertable,
  type SelectQueryBuilder,
} from 'kysely';
export { jsonArrayFrom } from 'kysely/helpers/postgres';
