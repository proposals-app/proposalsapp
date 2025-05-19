import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user_proposal_group_last_read")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("proposal_group_id", "uuid", (col) => col.notNull())
    .addColumn("last_read_at", "timestamp")
    .addUniqueConstraint(
      "user_proposal_group_last_read_user_id_proposal_group_id_unique",
      ["user_id", "proposal_group_id"],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_proposal_group_last_read").execute();
}
