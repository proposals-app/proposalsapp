import { defineConfig } from "kysely-ctl";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.WEB_DATABASE_URL,
      min: 5,
      max: 10,
    }),
  }),
  migrations: {
    migrationFolder: "/migrations",
  },
  seeds: {
    seedFolder: "/seeds",
  },
});
