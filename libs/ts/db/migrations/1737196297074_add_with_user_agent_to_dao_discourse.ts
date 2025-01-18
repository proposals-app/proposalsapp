import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add the with_user_agent column with default value false
  await db.schema
    .alterTable("dao_discourse")
    .addColumn("with_user_agent", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the with_user_agent column
  await db.schema
    .alterTable("dao_discourse")
    .dropColumn("with_user_agent")
    .execute();
}
