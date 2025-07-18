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

  if (!process.env.ARBITRUM_DATABASE_URL) {
    throw new Error('ARBITRUM_DATABASE_URL environment variable is not defined.');
  }

  if (!process.env.UNISWAP_DATABASE_URL) {
    throw new Error('UNISWAP_DATABASE_URL environment variable is not defined.');
  }
}

const { Pool } = pg;

// Use dummy connection strings during build phase
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build';
const ARBITRUM_DATABASE_URL = process.env.ARBITRUM_DATABASE_URL || 'postgresql://build:build@localhost:5432/build';
const UNISWAP_DATABASE_URL = process.env.UNISWAP_DATABASE_URL || 'postgresql://build:build@localhost:5432/build';

export const db_pool_public = new Pool({
  connectionString: DATABASE_URL,
  min: 5,
  max: 10,
});

export const db_pool_arbitrum = new Pool({
  connectionString: ARBITRUM_DATABASE_URL,
  options: '-c search_path=arbitrum',
  min: 5,
  max: 10,
});

export const db_pool_uniswap = new Pool({
  connectionString: UNISWAP_DATABASE_URL,
  options: '-c search_path=uniswap',
  min: 5,
  max: 10,
});

db_pool_arbitrum.on('connect', (client) => {
  client.query(`SET search_path TO arbitrum`);
});

db_pool_uniswap.on('connect', (client) => {
  client.query(`SET search_path TO uniswap`);
});

// Extend DB type with materialized views
type ExtendedDB = DB & MaterializedViews;

const createDbPublicInstance = () => {
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

const createDbUniswapInstance = () => {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: db_pool_uniswap,
    }),
    plugins: [
      new CamelCasePlugin(),
      new DeduplicateJoinsPlugin(),
      new ParseJSONResultsPlugin(),
    ],
  });
};

declare global {
  var dbPublicInternal: Kysely<ExtendedDB> | undefined;
  var dbArbitrumInternal: Kysely<DB> | undefined;
  var dbUniswapInternal: Kysely<DB> | undefined;
}

const dbPublic = global.dbPublicInternal || createDbPublicInstance();
const dbArbitrum = global.dbArbitrumInternal || createDbArbitrumInstance();
const dbUniswap = global.dbUniswapInternal || createDbUniswapInstance();

export const dbPool = {
  public: db_pool_public,
  arbitrum: db_pool_arbitrum,
  uniswap: db_pool_uniswap,
};

// Type for the db export
type DatabaseInstances = {
  public: Kysely<ExtendedDB>;
  arbitrum: Kysely<DB>;
  uniswap: Kysely<DB>;
};

export const db: DatabaseInstances = {
  public: dbPublic,
  arbitrum: dbArbitrum.withSchema('arbitrum') as Kysely<DB>,
  uniswap: dbUniswap.withSchema('uniswap') as Kysely<DB>,
};

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
