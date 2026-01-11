import { defineConfig } from 'kysely-ctl';
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  ParseJSONResultsPlugin,
  PostgresDialect,
} from 'kysely';
import { Pool } from 'pg';

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
      min: 5,
      max: 10,
    }),
  }),
  plugins: [
    new CamelCasePlugin(),
    new DeduplicateJoinsPlugin(),
    new ParseJSONResultsPlugin(),
  ],

  migrations: {
    migrationFolder:
      process.env.NODE_ENV === 'production' ? '/migrations' : '../migrations',
  },
  seeds: {
    seedFolder: process.env.NODE_ENV === 'production' ? '/seeds' : '../seeds',
  },
});
