import { sql, type Kysely } from "kysely";
import { DB } from "../src/kysely_db";

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createType("proposal_state_enum")
    .asEnum([
      "PENDING",
      "ACTIVE",
      "CANCELED",
      "DEFEATED",
      "SUCCEEDED",
      "QUEUED",
      "EXPIRED",
      "EXECUTED",
      "HIDDEN",
      "UNKNOWN",
    ])
    .execute();

  await db.schema
    .createType("notification_dispatched_state_enum")
    .asEnum([
      "NOT_DISPATCHED",
      "FIRST_RETRY",
      "SECOND_RETRY",
      "THIRD_RETRY",
      "DISPATCHED",
      "DELETED",
      "FAILED",
    ])
    .execute();

  await db.schema
    .createType("notification_type_enum")
    .asEnum(["BULLETIN_EMAIL", "QUORUM_NOT_REACHED_EMAIL", "TIMEEND_EMAIL"])
    .execute();

  await db.schema
    .createType("dao_handler_enum")
    .asEnum([
      "AAVE_V2_MAINNET",
      "COMPOUND_MAINNET",
      "UNISWAP_MAINNET",
      "ENS_MAINNET",
      "GITCOIN_MAINNET",
      "GITCOIN_V2_MAINNET",
      "HOP_MAINNET",
      "DYDX_MAINNET",
      "INTEREST_PROTOCOL_MAINNET",
      "ZEROX_PROTOCOL_MAINNET",
      "FRAX_ALPHA_MAINNET",
      "FRAX_OMEGA_MAINNET",
      "NOUNS_PROPOSALS_MAINNET",
      "OP_OPTIMISM",
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

  await db.schema
    .createTable("user")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("email", "text", (col) => col.unique().notNull())
    .addColumn("email_verified", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();

  await db.schema
    .createTable("user_session")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_user_session_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("email_verification")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.unique().notNull())
    .addColumn("code", "text", (col) => col.defaultTo("").notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_email_verification_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("user_settings")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.unique().notNull())
    .addColumn("email_daily_bulletin", "boolean", (col) =>
      col.defaultTo(true).notNull(),
    )
    .addColumn("email_quorum_warning", "boolean", (col) =>
      col.defaultTo(true).notNull(),
    )
    .addColumn("email_timeend_warning", "boolean", (col) =>
      col.defaultTo(true).notNull(),
    )
    .addForeignKeyConstraint(
      "fk_user_settings_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("voter")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("address", "text", (col) => col.unique().notNull())
    .addColumn("ens", "text")
    .execute();

  await db.schema
    .createTable("user_to_voter")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("voter_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_user_to_voter_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_user_to_voter_voter_id",
      ["voter_id"],
      "voter",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_user_to_voter", ["user_id", "voter_id"])
    .execute();

  await db.schema
    .createTable("dao")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.unique().notNull())
    .addColumn("slug", "text", (col) => col.unique().notNull())
    .addColumn("hot", "boolean", (col) => col.defaultTo(false).notNull())
    .execute();

  await db.schema
    .createTable("dao_settings")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.unique().notNull())
    .addColumn("picture", "text", (col) => col.notNull())
    .addColumn("background_color", "text", (col) =>
      col.defaultTo("#5A5A5A").notNull(),
    )
    .addColumn("quorum_warning_email_support", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("twitter_account", "json")
    .addForeignKeyConstraint(
      "fk_dao_settings_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("dao_handler")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("handler_type", sql`dao_handler_enum`, (col) => col.notNull())
    .addColumn("decoder", "json", (col) => col.defaultTo("{}").notNull())
    .addColumn("governance_portal", "text", (col) =>
      col.defaultTo("").notNull(),
    )
    .addColumn("refresh_enabled", "boolean", (col) =>
      col.defaultTo(true).notNull(),
    )
    .addColumn("proposals_refresh_speed", "integer", (col) =>
      col.defaultTo(1000).notNull(),
    )
    .addColumn("votes_refresh_speed", "integer", (col) =>
      col.defaultTo(1000).notNull(),
    )
    .addColumn("proposals_index", "integer", (col) =>
      col.defaultTo(0).notNull(),
    )
    .addColumn("votes_index", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_dao_handler_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_dao_handler", ["dao_id", "handler_type"])
    .execute();

  await db.schema
    .createTable("proposal")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("index_created", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("votes_fetched", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("votes_refresh_speed", "integer", (col) =>
      col.defaultTo(1000).notNull(),
    )
    .addColumn("votes_index", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("external_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("discussion_url", "text", (col) => col.notNull())
    .addColumn("choices", "json", (col) => col.defaultTo("[]").notNull())
    .addColumn("scores", "json", (col) => col.defaultTo("[]").notNull())
    .addColumn("scores_total", "float8", (col) => col.notNull())
    .addColumn("quorum", "float8", (col) => col.notNull())
    .addColumn("proposal_state", sql`proposal_state_enum`, (col) =>
      col.notNull(),
    )
    .addColumn("flagged", "boolean", (col) => col.defaultTo(false).notNull())
    .addColumn("block_created", "integer")
    .addColumn("time_created", "timestamp")
    .addColumn("time_start", "timestamp", (col) => col.notNull())
    .addColumn("time_end", "timestamp", (col) => col.notNull())
    .addColumn("dao_handler_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_proposal_dao_handler_id",
      ["dao_handler_id"],
      "dao_handler",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_proposal_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_proposal", ["external_id", "dao_handler_id"])
    .execute();

  await db.schema
    .createTable("vote")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("index_created", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("voter_address", "text", (col) => col.notNull())
    .addColumn("choice", "json", (col) => col.defaultTo("[]").notNull())
    .addColumn("voting_power", "float8", (col) => col.notNull())
    .addColumn("reason", "text")
    .addColumn("proposal_external_id", "text", (col) => col.notNull())
    .addColumn("block_created", "integer")
    .addColumn("time_created", "timestamp")
    .addColumn("vp_state", "text")
    .addColumn("proposal_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("dao_handler_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_vote_voter_address",
      ["voter_address"],
      "voter",
      ["address"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_proposal_id",
      ["proposal_id"],
      "proposal",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_dao_handler_id",
      ["dao_handler_id"],
      "dao_handler",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_vote", ["proposal_id", "voter_address"])
    .execute();

  await db.schema
    .createTable("subscription")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_subscription_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_subscription_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_subscription", ["user_id", "dao_id"])
    .execute();

  await db.schema
    .createTable("notification")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid")
    .addColumn("proposal_id", "uuid")
    .addColumn("type", sql`notification_type_enum`, (col) => col.notNull())
    .addColumn(
      "dispatchstatus",
      sql`notification_dispatched_state_enum`,
      (col) => col.defaultTo("NOT_DISPATCHED").notNull(),
    )
    .addColumn("submitted_at", "timestamp", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_notification_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_notification_proposal_id",
      ["proposal_id"],
      "proposal",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_notification", [
      "user_id",
      "proposal_id",
      "type",
    ])
    .execute();

  await db.schema
    .createTable("countdown_cache")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("time", "timestamp", (col) => col.notNull())
    .addColumn("large_url", "text", (col) => col.notNull())
    .addColumn("small_url", "text", (col) => col.notNull())
    .execute();

  // Add indexes separately
  await db.schema
    .createIndex("idx_user_session_user_id")
    .on("user_session")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_email_verification_user_id")
    .on("email_verification")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_user_to_voter_voter_id")
    .on("user_to_voter")
    .column("voter_id")
    .execute();

  await db.schema
    .createIndex("idx_proposal_dao_handler_id")
    .on("proposal")
    .column("dao_handler_id")
    .execute();

  await db.schema
    .createIndex("idx_proposal_dao_id")
    .on("proposal")
    .column("dao_id")
    .execute();

  await db.schema
    .createIndex("idx_proposal_state_dao_id")
    .on("proposal")
    .columns(["proposal_state", "dao_id"])
    .execute();

  await db.schema
    .createIndex("idx_proposal_time_end_name")
    .on("proposal")
    .columns(["time_end", "name"])
    .execute();

  await db.schema
    .createIndex("idx_vote_dao_handler_id")
    .on("vote")
    .column("dao_handler_id")
    .execute();

  await db.schema
    .createIndex("idx_vote_dao_id")
    .on("vote")
    .column("dao_id")
    .execute();

  await db.schema
    .createIndex("idx_vote_voter_address")
    .on("vote")
    .column("voter_address")
    .execute();

  await db.schema
    .createIndex("idx_vote_time_created")
    .on("vote")
    .column("time_created")
    .execute();

  await db.schema
    .createIndex("idx_vote_block_created")
    .on("vote")
    .column("block_created")
    .execute();

  await db.schema
    .createIndex("idx_subscription_dao_id")
    .on("subscription")
    .column("dao_id")
    .execute();

  await db.schema
    .createIndex("idx_notification_type")
    .on("notification")
    .column("type")
    .execute();

  await db.schema
    .createIndex("idx_notification_proposal_id")
    .on("notification")
    .column("proposal_id")
    .execute();

  await db.schema
    .createIndex("idx_notification_dispatchstatus")
    .on("notification")
    .column("dispatchstatus")
    .execute();

  await db.schema
    .createIndex("idx_notification_user_type_dispatchstatus")
    .on("notification")
    .columns(["user_id", "type", "dispatchstatus"])
    .execute();

  await db.schema
    .createIndex("idx_countdown_cache_time")
    .on("countdown_cache")
    .column("time")
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropIndex("idx_countdown_cache_time").execute();
  await db.schema
    .dropIndex("idx_notification_user_type_dispatchstatus")
    .execute();
  await db.schema.dropIndex("idx_notification_dispatchstatus").execute();
  await db.schema.dropIndex("idx_notification_proposal_id").execute();
  await db.schema.dropIndex("idx_notification_type").execute();
  await db.schema.dropIndex("idx_subscription_dao_id").execute();
  await db.schema.dropIndex("idx_vote_block_created").execute();
  await db.schema.dropIndex("idx_vote_time_created").execute();
  await db.schema.dropIndex("idx_vote_voter_address").execute();
  await db.schema.dropIndex("idx_vote_dao_id").execute();
  await db.schema.dropIndex("idx_vote_dao_handler_id").execute();
  await db.schema.dropIndex("idx_proposal_time_end_name").execute();
  await db.schema.dropIndex("idx_proposal_state_dao_id").execute();
  await db.schema.dropIndex("idx_proposal_dao_id").execute();
  await db.schema.dropIndex("idx_proposal_dao_handler_id").execute();
  await db.schema.dropIndex("idx_user_to_voter_voter_id").execute();
  await db.schema.dropIndex("idx_email_verification_user_id").execute();
  await db.schema.dropIndex("idx_user_session_user_id").execute();
  await db.schema.dropTable("countdown_cache").execute();
  await db.schema.dropTable("notification").execute();
  await db.schema.dropTable("subscription").execute();
  await db.schema.dropTable("vote").execute();
  await db.schema.dropTable("proposal").execute();
  await db.schema.dropTable("dao_handler").execute();
  await db.schema.dropTable("dao_settings").execute();
  await db.schema.dropTable("dao").execute();
  await db.schema.dropTable("user_to_voter").execute();
  await db.schema.dropTable("voter").execute();
  await db.schema.dropTable("user_settings").execute();
  await db.schema.dropTable("email_verification").execute();
  await db.schema.dropTable("user_session").execute();
  await db.schema.dropTable("user").execute();
  await db.schema.dropType("proposal_state_enum").execute();
  await db.schema.dropType("notification_dispatched_state_enum").execute();
  await db.schema.dropType("notification_type_enum").execute();
  await db.schema.dropType("dao_handler_enum").execute();
}
