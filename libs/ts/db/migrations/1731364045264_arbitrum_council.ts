import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add new indexer variants for Arbitrum Council
  await sql`
    ALTER TYPE indexer_variant ADD VALUE 'ARBITRUM_COUNCIL_NOMINATION_PROPOSAL';
    ALTER TYPE indexer_variant ADD VALUE 'ARBITRUM_COUNCIL_NOMINATION_VOTE';
    ALTER TYPE indexer_variant ADD VALUE 'ARBITRUM_COUNCIL_MEMBER_PROPOSAL';
    ALTER TYPE indexer_variant ADD VALUE 'ARBITRUM_COUNCIL_MEMBER_VOTE';
  `.execute(db);
}

export async function down(_db: Kysely<any>): Promise<void> {}
