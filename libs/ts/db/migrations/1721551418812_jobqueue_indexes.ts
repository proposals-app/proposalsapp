import type { Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createIndex("idx_job_queue_job_type")
    .on("job_queue")
    .column("job_type")
    .execute();

  await db.schema
    .createIndex("idx_job_queue_processed")
    .on("job_queue")
    .column("processed")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropIndex("idx_job_queue_job_type").execute();
  await db.schema.dropIndex("idx_job_queue_processed").execute();
}
