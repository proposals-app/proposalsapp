import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
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

function parsePoolInteger(
  value: string | undefined,
  fallback: number,
  minimum = 0
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

// Use dummy connection strings during build phase
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build';

const poolMin = parsePoolInteger(process.env.DB_POOL_MIN, 0);
const poolMax = parsePoolInteger(process.env.DB_POOL_MAX, 10, 1);
const poolConnectTimeoutMs = parsePoolInteger(
  process.env.DB_POOL_CONNECT_TIMEOUT_MS,
  10_000
);
const poolIdleTimeoutMs = parsePoolInteger(
  process.env.DB_POOL_IDLE_TIMEOUT_MS,
  30_000
);

// Extend DB type with materialized views
type ExtendedDB = DB & MaterializedViews;

function createPool(): InstanceType<typeof Pool> {
  return new Pool({
    connectionString: DATABASE_URL,
    min: Math.min(poolMin, poolMax),
    max: poolMax,
    connectionTimeoutMillis: poolConnectTimeoutMs,
    idleTimeoutMillis: poolIdleTimeoutMs,
    allowExitOnIdle: isBuildPhase || process.env.NODE_ENV === 'test',
  });
}

const createDbInstance = (pool: InstanceType<typeof Pool>) => {
  return new Kysely<ExtendedDB>({
    dialect: new PostgresDialect({
      pool,
    }),
    plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
  });
};

declare global {
  var dbPoolInternal: InstanceType<typeof Pool> | undefined;
  var dbInternal: Kysely<ExtendedDB> | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';
const poolInstance = isProduction
  ? createPool()
  : (globalThis.dbPoolInternal ??= createPool());
const dbInstance = isProduction
  ? createDbInstance(poolInstance)
  : (globalThis.dbInternal ??= createDbInstance(poolInstance));

// Keep the legacy alias for consumers while exposing the same singleton pool.
export const db_pool_public = poolInstance;
export const dbPool = poolInstance;

// Export the single database instance
export const db = dbInstance;

//if (process.env.NODE_ENV !== "production") global.dbPublic = dbPublic;
//if (process.env.NODE_ENV !== "production") global.dbArbitrum = dbArbitrum;
//if (process.env.NODE_ENV !== "production") global.dbUniswap = dbUniswap;

export * from './kysely_db';
export { Kysely };
export {
  sql,
  type Selectable,
  type Insertable,
  type SelectQueryBuilder,
} from 'kysely';
export { jsonArrayFrom } from 'kysely/helpers/postgres';
