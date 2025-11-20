import { defineConfig } from 'kysely-ctl';
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  ParseJSONResultsPlugin,
  PostgresDialect,
} from 'kysely';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    migrationFolder: join(__dirname, '../migrations'),
  },
  seeds: {
    seedFolder: join(__dirname, '../seeds'),
  },
});
