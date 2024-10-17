import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("discourse_post")
    .addColumn("can_view_edit_history", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("discourse_post")
    .dropColumn("can_view_edit_history")
    .execute();
}
