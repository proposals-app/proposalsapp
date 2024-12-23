import { type Kysely } from "kysely";
import { DB } from "./../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  // Add the dao_id column to the proposal_group table
  await db.schema
    .alterTable("proposal_group")
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .execute();

  // Add a foreign key constraint linking dao_id to the id in the dao table
  await db.schema
    .alterTable("proposal_group")
    .addForeignKeyConstraint("fk_proposal_group_dao_id", ["dao_id"], "dao", [
      "id",
    ])
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop the foreign key constraint
  await db.schema
    .alterTable("proposal_group")
    .dropConstraint("fk_proposal_group_dao_id")
    .execute();

  // Drop the dao_id column from the proposal_group table
  await db.schema.alterTable("proposal_group").dropColumn("dao_id").execute();
}
