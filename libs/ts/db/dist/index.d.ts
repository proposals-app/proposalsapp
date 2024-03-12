import { Kysely } from "kysely";
import type { DB } from "./kysely";
declare const db: Kysely<DB>;
export default db;
export * from "./kysely";
export { jsonArrayFrom } from "kysely/helpers/mysql";
//# sourceMappingURL=index.d.ts.map