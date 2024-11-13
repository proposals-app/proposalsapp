import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add new indexer types and variants for Arbitrum Council
  await sql`
    ALTER TYPE indexer_type ADD VALUE 'PROPOSALS_AND_VOTES';
    ALTER TYPE indexer_variant ADD VALUE 'ARBITRUM_COUNCIL_NOMINATIONS';
    ALTER TYPE indexer_variant ADD VALUE 'ARBITRUM_COUNCIL_ELECTIONS';
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Create a new enum type without the added values
  await sql`
    CREATE TYPE indexer_type_new AS ENUM (
      'PROPOSALS',
      'VOTES',
      'VOTING_POWER',
      'DELEGATION'
    );
  `.execute(db);

  await sql`
    CREATE TYPE indexer_variant_new AS ENUM (
      'AAVE_V2_MAINNET_PROPOSALS',
      'AAVE_V2_MAINNET_VOTES',
      'AAVE_V3_MAINNET_PROPOSALS',
      'AAVE_V3_MAINNET_VOTES',
      'AAVE_V3_POLYGON_VOTES',
      'AAVE_V3_AVALANCHE_VOTES',
      'COMPOUND_MAINNET_PROPOSALS',
      'COMPOUND_MAINNET_VOTES',
      'UNISWAP_MAINNET_PROPOSALS',
      'UNISWAP_MAINNET_VOTES',
      'ENS_MAINNET_PROPOSALS',
      'ENS_MAINNET_VOTES',
      'GITCOIN_MAINNET_PROPOSALS',
      'GITCOIN_MAINNET_VOTES',
      'GITCOIN_V2_MAINNET_PROPOSALS',
      'GITCOIN_V2_MAINNET_VOTES',
      'HOP_MAINNET_PROPOSALS',
      'HOP_MAINNET_VOTES',
      'DYDX_MAINNET_PROPOSALS',
      'DYDX_MAINNET_VOTES',
      'FRAX_ALPHA_MAINNET_PROPOSALS',
      'FRAX_ALPHA_MAINNET_VOTES',
      'FRAX_OMEGA_MAINNET_PROPOSALS',
      'FRAX_OMEGA_MAINNET_VOTES',
      'NOUNS_PROPOSALS_MAINNET_PROPOSALS',
      'NOUNS_PROPOSALS_MAINNET_VOTES',
      'OP_OPTIMISM_PROPOSALS',
      'OP_OPTIMISM_VOTES',
      'ARB_CORE_ARBITRUM_PROPOSALS',
      'ARB_CORE_ARBITRUM_VOTES',
      'ARB_TREASURY_ARBITRUM_PROPOSALS',
      'ARB_TREASURY_ARBITRUM_VOTES',
      'MAKER_EXECUTIVE_MAINNET_PROPOSALS',
      'MAKER_EXECUTIVE_MAINNET_VOTES',
      'MAKER_POLL_MAINNET_PROPOSALS',
      'MAKER_POLL_MAINNET_VOTES',
      'MAKER_POLL_ARBITRUM_VOTES',
      'SNAPSHOT_PROPOSALS',
      'SNAPSHOT_VOTES',
      'ARB_ARBITRUM_VOTING_POWER',
      'ARB_ARBITRUM_DELEGATION'
    );
  `.execute(db);

  // Update the dao_indexer table to use the new enum types
  await sql`
    ALTER TABLE dao_indexer
    ALTER COLUMN indexer_type TYPE indexer_type_new USING indexer_type::text::indexer_type_new;
  `.execute(db);

  await sql`
    ALTER TABLE dao_indexer
    ALTER COLUMN indexer_variant TYPE indexer_variant_new USING indexer_variant::text::indexer_variant_new;
  `.execute(db);

  // Drop the old enum types if they're no longer needed
  await sql`
    DROP TYPE indexer_type;
  `.execute(db);

  await sql`
    DROP TYPE indexer_variant;
  `.execute(db);

  // Rename the new enum types to the original names
  await sql`
    ALTER TYPE indexer_type_new RENAME TO indexer_type;
  `.execute(db);

  await sql`
    ALTER TYPE indexer_variant_new RENAME TO indexer_variant;
  `.execute(db);
}
