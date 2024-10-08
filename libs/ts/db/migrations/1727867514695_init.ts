import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await createUserTables(db);
  await createDaoTables(db);
  await createIndexerTables(db);
  await createVoterTables(db);
  await createProposalTables(db);
  await createVoteTables(db);
  await createSubscriptionTables(db);
  await createNotificationTables(db);
  await createJobTables(db);
  await createDiscourseTables(db);
}

async function createUserTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("email", "text", (col) => col.unique().notNull())
    .addColumn("email_verified", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await db.schema
    .createIndex("idx_user_email")
    .on("user")
    .column("email")
    .execute();

  await db.schema
    .createTable("user_session")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addForeignKeyConstraint(
      "fk_user_session_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createIndex("idx_user_session_user_id")
    .on("user_session")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("email_verification")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("user_id", "uuid", (col) => col.unique().notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
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
      col.defaultTo(false).notNull(),
    )
    .addColumn("email_timeend_warning", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("push_notifications", "boolean", (col) =>
      col.defaultTo(false).notNull(),
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
    .createTable("user_push_notification_subscription")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("endpoint", "text", (col) => col.notNull())
    .addColumn("p256dh", "text", (col) => col.notNull())
    .addColumn("auth", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_user_push_notification_subscription_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_user_subscription", ["user_id", "endpoint"])
    .execute();
}

async function createDaoTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("dao")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.unique().notNull())
    .addColumn("slug", "text", (col) => col.unique().notNull())
    .addColumn("picture", "text", (col) => col.notNull())
    .addColumn("background_color", "text", (col) =>
      col.defaultTo("#5A5A5A").notNull(),
    )
    .addColumn("hot", "boolean", (col) => col.defaultTo(false).notNull())
    .addColumn("email_quorum_warning_support", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();

  await db.schema
    .createIndex("idx_dao_slug")
    .on("dao")
    .column("slug")
    .execute();
}

async function createIndexerTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType("indexer_type")
    .asEnum(["PROPOSALS", "VOTES"])
    .execute();

  await db.schema
    .createType("indexer_variant")
    .asEnum([
      "AAVE_V2_MAINNET_PROPOSALS",
      "AAVE_V2_MAINNET_VOTES",
      "AAVE_V3_MAINNET_PROPOSALS",
      "AAVE_V3_MAINNET_VOTES",
      "AAVE_V3_POLYGON_VOTES",
      "AAVE_V3_AVALANCHE_VOTES",
      "COMPOUND_MAINNET_PROPOSALS",
      "COMPOUND_MAINNET_VOTES",
      "UNISWAP_MAINNET_PROPOSALS",
      "UNISWAP_MAINNET_VOTES",
      "ENS_MAINNET_PROPOSALS",
      "ENS_MAINNET_VOTES",
      "GITCOIN_MAINNET_PROPOSALS",
      "GITCOIN_MAINNET_VOTES",
      "GITCOIN_V2_MAINNET_PROPOSALS",
      "GITCOIN_V2_MAINNET_VOTES",
      "HOP_MAINNET_PROPOSALS",
      "HOP_MAINNET_VOTES",
      "DYDX_MAINNET_PROPOSALS",
      "DYDX_MAINNET_VOTES",
      "FRAX_ALPHA_MAINNET_PROPOSALS",
      "FRAX_ALPHA_MAINNET_VOTES",
      "FRAX_OMEGA_MAINNET_PROPOSALS",
      "FRAX_OMEGA_MAINNET_VOTES",
      "NOUNS_PROPOSALS_MAINNET_PROPOSALS",
      "NOUNS_PROPOSALS_MAINNET_VOTES",
      "OP_OPTIMISM_PROPOSALS",
      "OP_OPTIMISM_VOTES",
      "ARB_CORE_ARBITRUM_PROPOSALS",
      "ARB_CORE_ARBITRUM_VOTES",
      "ARB_TREASURY_ARBITRUM_PROPOSALS",
      "ARB_TREASURY_ARBITRUM_VOTES",
      "MAKER_EXECUTIVE_MAINNET_PROPOSALS",
      "MAKER_EXECUTIVE_MAINNET_VOTES",
      "MAKER_POLL_MAINNET_PROPOSALS",
      "MAKER_POLL_MAINNET_VOTES",
      "MAKER_POLL_ARBITRUM_VOTES",
      "SNAPSHOT_PROPOSALS",
      "SNAPSHOT_VOTES",
    ])
    .execute();

  await db.schema
    .createTable("dao_indexer")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.defaultTo(true).notNull())
    .addColumn("indexer_type", sql`indexer_type`, (col) => col.notNull())
    .addColumn("indexer_variant", sql`indexer_variant`, (col) => col.notNull())
    .addColumn("index", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("speed", "integer", (col) => col.defaultTo(1000).notNull())
    .addColumn("portal_url", "text")
    .addForeignKeyConstraint(
      "fk_dao_indexer_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_dao_indexer", ["dao_id", "indexer_variant"])
    .execute();

  await db.schema
    .createIndex("idx_dao_indexer_dao_id")
    .on("dao_indexer")
    .column("dao_id")
    .execute();
}

async function createVoterTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("voter")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("address", "text", (col) => col.unique().notNull())
    .addColumn("ens", "text")
    .execute();

  await db.schema
    .createIndex("idx_voter_address")
    .on("voter")
    .column("address")
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
    .createIndex("idx_user_to_voter_user_id")
    .on("user_to_voter")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_user_to_voter_voter_id")
    .on("user_to_voter")
    .column("voter_id")
    .execute();
}

async function createProposalTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType("proposal_state")
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
    .createTable("proposal")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("index_created", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("external_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("discussion_url", "text", (col) => col.notNull())
    .addColumn("choices", "jsonb", (col) => col.defaultTo("[]").notNull())
    .addColumn("scores", "jsonb", (col) => col.defaultTo("[]").notNull())
    .addColumn("scores_total", "float8", (col) => col.notNull())
    .addColumn("quorum", "float8", (col) => col.notNull())
    .addColumn("scores_quorum", "float8", (col) => col.notNull())
    .addColumn("proposal_state", sql`proposal_state`, (col) => col.notNull())
    .addColumn("flagged_spam", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("time_created", "timestamp", (col) => col.notNull())
    .addColumn("time_start", "timestamp", (col) => col.notNull())
    .addColumn("time_end", "timestamp", (col) => col.notNull())
    .addColumn("block_created", "integer")
    .addColumn("txid", "text")
    .addColumn("metadata", "jsonb")
    .addColumn("dao_indexer_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_proposal_dao_indexer_id",
      ["dao_indexer_id"],
      "dao_indexer",
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
    .addUniqueConstraint("unique_proposal", ["external_id", "dao_indexer_id"])
    .execute();

  await db.schema
    .createIndex("idx_proposal_dao_id")
    .on("proposal")
    .column("dao_id")
    .execute();

  await db.schema
    .createIndex("idx_proposal_time_start")
    .on("proposal")
    .column("time_start")
    .execute();

  await db.schema
    .createIndex("idx_proposal_time_end")
    .on("proposal")
    .column("time_end")
    .execute();

  await db.schema
    .createIndex("idx_proposal_proposal_state")
    .on("proposal")
    .column("proposal_state")
    .execute();
}

async function createVoteTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("vote")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("index_created", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("voter_address", "text", (col) => col.notNull())
    .addColumn("choice", "jsonb", (col) => col.defaultTo("[]").notNull())
    .addColumn("voting_power", "float8", (col) => col.notNull())
    .addColumn("reason", "text")
    .addColumn("proposal_external_id", "text", (col) => col.notNull())
    .addColumn("time_created", "timestamp")
    .addColumn("block_created", "integer")
    .addColumn("txid", "text")
    .addColumn("proposal_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("indexer_id", "uuid", (col) => col.notNull())
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
      "fk_vote_dao_indexer_id",
      ["indexer_id"],
      "dao_indexer",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addUniqueConstraint("unique_vote", ["proposal_id", "voter_address"])
    .execute();

  await db.schema
    .createIndex("idx_vote_proposal_id")
    .on("vote")
    .column("proposal_id")
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
}

async function createSubscriptionTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("subscription")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
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
    .createIndex("idx_subscription_user_id")
    .on("subscription")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_subscription_dao_id")
    .on("subscription")
    .column("dao_id")
    .execute();
}

async function createNotificationTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType("notification_type_enum")
    .asEnum([
      "EMAIL_BULLETIN",
      "EMAIL_QUORUM_NOT_REACHED",
      "EMAIL_TIMEEND",
      "PUSH_QUORUM_NOT_REACHED",
      "PUSH_TIMEEND",
    ])
    .execute();

  await db.schema
    .createType("notification_dispatch_status_enum")
    .asEnum(["NOT_DISPATCHED", "DISPATCHED", "FAILED"])
    .execute();

  await db.schema
    .createTable("notification")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("proposal_id", "uuid", (col) => col.notNull())
    .addColumn("type", sql`notification_type_enum`, (col) => col.notNull())
    .addColumn(
      "dispatch_status",
      sql`notification_dispatch_status_enum`,
      (col) => col.defaultTo("NOT_DISPATCHED").notNull(),
    )
    .addColumn("dispatched_at", "timestamp")
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
    .createIndex("idx_notification_user_id")
    .on("notification")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_notification_proposal_id")
    .on("notification")
    .column("proposal_id")
    .execute();

  await db.schema
    .createIndex("idx_notification_dispatch_status")
    .on("notification")
    .column("dispatch_status")
    .execute();
}

async function createJobTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("job", "jsonb", (col) => col.notNull())
    .addColumn("job_type", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("processed", "boolean", (col) => col.defaultTo(false))
    .execute();

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

async function createDiscourseTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("dao_discourse")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("discourse_base_url", "text", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.defaultTo(true).notNull())
    .addForeignKeyConstraint(
      "fk_dao_discourse_dao_id",
      ["dao_id"],
      "dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("discourse_user")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("avatar_template", "text", (col) => col.notNull())
    .addColumn("title", "text")
    .addColumn("likes_received", "bigint")
    .addColumn("likes_given", "bigint")
    .addColumn("topics_entered", "bigint")
    .addColumn("topic_count", "bigint")
    .addColumn("post_count", "bigint")
    .addColumn("posts_read", "bigint")
    .addColumn("days_visited", "bigint")
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_user_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("discourse_category")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("color", "text", (col) => col.notNull())
    .addColumn("text_color", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("topic_count", "integer", (col) => col.notNull())
    .addColumn("post_count", "integer", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("description_text", "text")
    .addColumn("topics_day", "integer")
    .addColumn("topics_week", "integer")
    .addColumn("topics_month", "integer")
    .addColumn("topics_year", "integer")
    .addColumn("topics_all_time", "integer")
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_category_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("discourse_topic")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("fancy_title", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("posts_count", "integer", (col) => col.notNull())
    .addColumn("reply_count", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("last_posted_at", "timestamp", (col) => col.notNull())
    .addColumn("bumped_at", "timestamp", (col) => col.notNull())
    .addColumn("pinned", "boolean", (col) => col.notNull())
    .addColumn("pinned_globally", "boolean", (col) => col.notNull())
    .addColumn("visible", "boolean", (col) => col.notNull())
    .addColumn("closed", "boolean", (col) => col.notNull())
    .addColumn("archived", "boolean", (col) => col.notNull())
    .addColumn("views", "integer", (col) => col.notNull())
    .addColumn("like_count", "integer", (col) => col.notNull())
    .addColumn("category_id", "integer", (col) => col.notNull())
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_topic_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("discourse_post")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("cooked", "text", (col) => col.notNull())
    .addColumn("post_number", "integer", (col) => col.notNull())
    .addColumn("post_type", "integer", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .addColumn("reply_count", "integer", (col) => col.notNull())
    .addColumn("reply_to_post_number", "integer")
    .addColumn("quote_count", "integer", (col) => col.notNull())
    .addColumn("incoming_link_count", "integer", (col) => col.notNull())
    .addColumn("reads", "integer", (col) => col.notNull())
    .addColumn("readers_count", "integer", (col) => col.notNull())
    .addColumn("score", "float8", (col) => col.notNull())
    .addColumn("topic_id", "integer", (col) => col.notNull())
    .addColumn("topic_slug", "text", (col) => col.notNull())
    .addColumn("display_username", "text")
    .addColumn("primary_group_name", "text")
    .addColumn("flair_name", "text")
    .addColumn("flair_url", "text")
    .addColumn("flair_bg_color", "text")
    .addColumn("flair_color", "text")
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_post_dao_discourse_id",
      ["dao_discourse_id"],
      "dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  // Add unique constraints and indexes
  await db.schema
    .alterTable("discourse_user")
    .addUniqueConstraint("uq_discourse_user_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_user_external_id")
    .on("discourse_user")
    .column("external_id")
    .execute();

  await db.schema
    .alterTable("discourse_category")
    .addUniqueConstraint("uq_discourse_category_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_category_external_id")
    .on("discourse_category")
    .column("external_id")
    .execute();

  await db.schema
    .alterTable("discourse_topic")
    .addUniqueConstraint("uq_discourse_topic_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_topic_external_id")
    .on("discourse_topic")
    .column("external_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_topic_category_id")
    .on("discourse_topic")
    .column("category_id")
    .execute();

  await db.schema
    .alterTable("discourse_post")
    .addUniqueConstraint("uq_discourse_post_external_id_dao_discourse_id", [
      "external_id",
      "dao_discourse_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_external_id")
    .on("discourse_post")
    .column("external_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_user_id")
    .on("discourse_post")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_discourse_post_topic_id")
    .on("discourse_post")
    .column("topic_id")
    .execute();

  // Add foreign key relationships
  await db.schema
    .alterTable("discourse_post")
    .addForeignKeyConstraint(
      "fk_discourse_post_user",
      ["user_id", "dao_discourse_id"],
      "discourse_user",
      ["external_id", "dao_discourse_id"],
    )
    .execute();

  await db.schema
    .alterTable("discourse_post")
    .addForeignKeyConstraint(
      "fk_discourse_post_topic",
      ["topic_id", "dao_discourse_id"],
      "discourse_topic",
      ["external_id", "dao_discourse_id"],
    )
    .execute();

  await db.schema
    .alterTable("discourse_topic")
    .addForeignKeyConstraint(
      "fk_discourse_topic_category",
      ["category_id", "dao_discourse_id"],
      "discourse_category",
      ["external_id", "dao_discourse_id"],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order of creation
  await db.schema.dropTable("discourse_post").execute();
  await db.schema.dropTable("discourse_topic").execute();
  await db.schema.dropTable("discourse_category").execute();
  await db.schema.dropTable("discourse_user").execute();
  await db.schema.dropTable("dao_discourse").execute();

  await db.schema.dropTable("job_queue").execute();
  await db.schema.dropTable("notification").execute();
  await db.schema.dropTable("subscription").execute();
  await db.schema.dropTable("vote").execute();
  await db.schema.dropTable("proposal").execute();
  await db.schema.dropTable("user_to_voter").execute();
  await db.schema.dropTable("voter").execute();
  await db.schema.dropTable("dao_indexer").execute();
  await db.schema.dropTable("dao").execute();
  await db.schema.dropTable("user_push_notification_subscription").execute();
  await db.schema.dropTable("user_settings").execute();
  await db.schema.dropTable("email_verification").execute();
  await db.schema.dropTable("user_session").execute();
  await db.schema.dropTable("user").execute();

  // Drop custom types
  await db.schema.dropType("notification_dispatch_status_enum").execute();
  await db.schema.dropType("notification_type_enum").execute();
  await db.schema.dropType("proposal_state").execute();
  await db.schema.dropType("indexer_type").execute();
  await db.schema.dropType("indexer_variant").execute();
}
