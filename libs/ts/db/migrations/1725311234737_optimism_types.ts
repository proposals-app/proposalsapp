import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  // Create the new enum type without the removed values
  await db.schema
    .createType("dao_handler_enum_v3")
    .asEnum([
      "AAVE_V2_MAINNET",
      "COMPOUND_MAINNET",
      "UNISWAP_MAINNET",
      "ENS_MAINNET",
      "GITCOIN_MAINNET",
      "GITCOIN_V2_MAINNET",
      "HOP_MAINNET",
      "DYDX_MAINNET",
      "FRAX_ALPHA_MAINNET",
      "FRAX_OMEGA_MAINNET",
      "NOUNS_PROPOSALS_MAINNET",
      "OP_OPTIMISM_OLD",
      "OP_OPTIMISM_TYPE1",
      "OP_OPTIMISM_TYPE2",
      "OP_OPTIMISM_TYPE3",
      "OP_OPTIMISM_TYPE4",
      "ARB_CORE_ARBITRUM",
      "ARB_TREASURY_ARBITRUM",
      "MAKER_EXECUTIVE_MAINNET",
      "MAKER_POLL_MAINNET",
      "MAKER_POLL_ARBITRUM",
      "AAVE_V3_MAINNET",
      "AAVE_V3_POLYGON_POS",
      "AAVE_V3_AVALANCHE",
      "SNAPSHOT",
    ])
    .execute();

  // Create a temporary column to hold the new enum values
  await db.schema
    .alterTable("dao_handler")
    .addColumn("handler_type_temp", sql`dao_handler_enum_v3`)
    .execute();

  await sql`
    UPDATE dao_handler
    SET handler_type_temp = CASE
      WHEN handler_type = 'AAVE_V2_MAINNET' THEN 'AAVE_V2_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'COMPOUND_MAINNET' THEN 'COMPOUND_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'UNISWAP_MAINNET' THEN 'UNISWAP_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'ENS_MAINNET' THEN 'ENS_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'GITCOIN_MAINNET' THEN 'GITCOIN_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'GITCOIN_V2_MAINNET' THEN 'GITCOIN_V2_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'HOP_MAINNET' THEN 'HOP_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'DYDX_MAINNET' THEN 'DYDX_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'FRAX_ALPHA_MAINNET' THEN 'FRAX_ALPHA_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'FRAX_OMEGA_MAINNET' THEN 'FRAX_OMEGA_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'NOUNS_PROPOSALS_MAINNET' THEN 'NOUNS_PROPOSALS_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'OP_OPTIMISM' THEN 'OP_OPTIMISM_OLD'::dao_handler_enum_v3
      WHEN handler_type = 'ARB_CORE_ARBITRUM' THEN 'ARB_CORE_ARBITRUM'::dao_handler_enum_v3
      WHEN handler_type = 'ARB_TREASURY_ARBITRUM' THEN 'ARB_TREASURY_ARBITRUM'::dao_handler_enum_v3
      WHEN handler_type = 'MAKER_EXECUTIVE_MAINNET' THEN 'MAKER_EXECUTIVE_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'MAKER_POLL_MAINNET' THEN 'MAKER_POLL_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'MAKER_POLL_ARBITRUM' THEN 'MAKER_POLL_ARBITRUM'::dao_handler_enum_v3
      WHEN handler_type = 'AAVE_V3_MAINNET' THEN 'AAVE_V3_MAINNET'::dao_handler_enum_v3
      WHEN handler_type = 'AAVE_V3_POLYGON_POS' THEN 'AAVE_V3_POLYGON_POS'::dao_handler_enum_v3
      WHEN handler_type = 'AAVE_V3_AVALANCHE' THEN 'AAVE_V3_AVALANCHE'::dao_handler_enum_v3
      WHEN handler_type = 'SNAPSHOT' THEN 'SNAPSHOT'::dao_handler_enum_v3
      ELSE NULL
    END
  `.execute(db);

  // Drop the old column
  await db.schema
    .alterTable("dao_handler")
    .dropColumn("handler_type")
    .execute();

  // Rename the temporary column to the original column name
  await db.schema
    .alterTable("dao_handler")
    .renameColumn("handler_type_temp", "handler_type")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await sql`
      UPDATE dao_handler
      SET handler_type_temp = CASE
        WHEN handler_type = 'AAVE_V2_MAINNET' THEN 'AAVE_V2_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'COMPOUND_MAINNET' THEN 'COMPOUND_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'UNISWAP_MAINNET' THEN 'UNISWAP_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'ENS_MAINNET' THEN 'ENS_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'GITCOIN_MAINNET' THEN 'GITCOIN_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'GITCOIN_V2_MAINNET' THEN 'GITCOIN_V2_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'HOP_MAINNET' THEN 'HOP_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'DYDX_MAINNET' THEN 'DYDX_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'FRAX_ALPHA_MAINNET' THEN 'FRAX_ALPHA_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'FRAX_OMEGA_MAINNET' THEN 'FRAX_OMEGA_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'NOUNS_PROPOSALS_MAINNET' THEN 'NOUNS_PROPOSALS_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'OP_OPTIMISM_OLD' THEN 'OP_OPTIMISM'::dao_handler_enum_v2
        WHEN handler_type = 'OP_OPTIMISM_TYPE1' THEN 'OP_OPTIMISM'::dao_handler_enum_v2
        WHEN handler_type = 'OP_OPTIMISM_TYPE2' THEN 'OP_OPTIMISM'::dao_handler_enum_v2
        WHEN handler_type = 'OP_OPTIMISM_TYPE3' THEN 'OP_OPTIMISM'::dao_handler_enum_v2
        WHEN handler_type = 'OP_OPTIMISM_TYPE4' THEN 'OP_OPTIMISM'::dao_handler_enum_v2
        WHEN handler_type = 'ARB_CORE_ARBITRUM' THEN 'ARB_CORE_ARBITRUM'::dao_handler_enum_v2
        WHEN handler_type = 'ARB_TREASURY_ARBITRUM' THEN 'ARB_TREASURY_ARBITRUM'::dao_handler_enum_v2
        WHEN handler_type = 'MAKER_EXECUTIVE_MAINNET' THEN 'MAKER_EXECUTIVE_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'MAKER_POLL_MAINNET' THEN 'MAKER_POLL_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'MAKER_POLL_ARBITRUM' THEN 'MAKER_POLL_ARBITRUM'::dao_handler_enum_v2
        WHEN handler_type = 'AAVE_V3_MAINNET' THEN 'AAVE_V3_MAINNET'::dao_handler_enum_v2
        WHEN handler_type = 'AAVE_V3_POLYGON_POS' THEN 'AAVE_V3_POLYGON_POS'::dao_handler_enum_v2
        WHEN handler_type = 'AAVE_V3_AVALANCHE' THEN 'AAVE_V3_AVALANCHE'::dao_handler_enum_v2
        WHEN handler_type = 'SNAPSHOT' THEN 'SNAPSHOT'::dao_handler_enum_v2
        ELSE NULL
      END
    `.execute(db);
}
