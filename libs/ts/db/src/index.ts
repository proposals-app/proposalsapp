import { DeduplicateJoinsPlugin, Kysely, MysqlDialect } from "kysely";
import type { DB } from "./kysely_db";
import { CamelCasePlugin } from "kysely";
import { createPool } from "mysql2";

const dialect = new MysqlDialect({
  pool: createPool(process.env.DATABASE_URL!),
});

const db = new Kysely<DB>({
  dialect: dialect,
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});

export default db;
export * from "./kysely_db";
export * from "./enums";
export type { DB } from "./kysely_db";
export { Kysely };
export { jsonArrayFrom } from "kysely/helpers/mysql";
