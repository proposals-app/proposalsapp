import { type Kysely } from "kysely";

// `any` is used here as the database schema might evolve,
// and migrations should ideally work against the schema state at the time they were written.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("proposal")
    .addColumn("block_start_at", "integer") // Nullable by default
    .addColumn("block_end_at", "integer") // Nullable by default
    .execute();

  // Optional: Add indexes if these columns will be frequently queried or filtered upon
  await db.schema
    .createIndex("idx_proposal_block_start_at")
    .on("proposal")
    .column("block_start_at")
    .execute();

  await db.schema
    .createIndex("idx_proposal_block_end_at")
    .on("proposal")
    .column("block_end_at")
    .execute();
}

// `any` is used here for consistency with the `up` function's reasoning.
export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex("idx_proposal_block_end_at").ifExists().execute();
  await db.schema.dropIndex("idx_proposal_block_start_at").ifExists().execute();

  // Then drop columns
  await db.schema
    .alterTable("proposal")
    .dropColumn("block_end_at")
    .dropColumn("block_start_at")
    .execute();
}
