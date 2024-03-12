import { DeduplicateJoinsPlugin, Kysely } from "kysely";
import type { DB } from "./kysely_db";
import { PlanetScaleDialect } from "kysely-planetscale";
import { CamelCasePlugin } from "kysely";

const db = new Kysely<DB>({
  dialect: new PlanetScaleDialect({
    url: process.env.DATABASE_URL,
  }),
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});

export default db;
export * from "./kysely_db";
export * from "./enums";
export type { DB } from "./kysely_db";
export { Kysely, PlanetScaleDialect };
export { connect } from "@planetscale/database";
export { jsonArrayFrom } from "kysely/helpers/mysql";
