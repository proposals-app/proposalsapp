import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // --- SCHEMAS ---
  await sql`CREATE SCHEMA IF NOT EXISTS "public";`.execute(db);
  await sql`COMMENT ON SCHEMA "public" IS 'standard public schema';`.execute(
    db,
  );

  // --- ENUM TYPES ---
  await db.schema
    .createType("public.proposal_state")
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

  // --- TABLES IN public SCHEMA ---
  await db.schema
    .createTable("public.job_queue")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("data", "jsonb", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("PENDING"))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await db.schema
    .createTable("public.dao")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("picture", "text", (col) => col.notNull())
    .execute();
  // Indexes for dao
  await db.schema
    .createIndex("dao_name_key")
    .on("public.dao")
    .column("name")
    .unique()
    .execute();
  await db.schema
    .createIndex("dao_slug_key")
    .on("public.dao")
    .column("slug")
    .unique()
    .execute();
  await db.schema
    .createIndex("idx_dao_slug")
    .on("public.dao")
    .column("slug")
    .execute();

  await db.schema
    .createTable("public.dao_discourse")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("discourse_base_url", "text", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("with_user_agent", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addForeignKeyConstraint(
      "fk_dao_discourse_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("public.dao_governor")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("portal_url", "text")
    .addForeignKeyConstraint(
      "fk_dao_governor_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for dao_governor
  await db.schema
    .createIndex("governor_new_pkey")
    .on("public.dao_governor")
    .column("id")
    .unique()
    .execute();
  await db.schema
    .createIndex("idx_governor_new_dao_id")
    .on("public.dao_governor")
    .column("dao_id")
    .execute();

  await db.schema
    .createTable("public.delegate")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_delegate_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createTable("public.discourse_user")
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
      "public.dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for discourse_user
  await db.schema
    .createIndex("idx_discourse_user_external_id")
    .on("public.discourse_user")
    .column("external_id")
    .execute();
  await db.schema
    .createIndex("uq_discourse_user_external_id_dao_discourse_id")
    .on("public.discourse_user")
    .columns(["external_id", "dao_discourse_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("public.delegate_to_discourse_user")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("delegate_id", "uuid", (col) => col.notNull())
    .addColumn("discourse_user_id", "uuid", (col) => col.notNull())
    .addColumn("period_start", "timestamp", (col) => col.notNull())
    .addColumn("period_end", "timestamp", (col) => col.notNull())
    .addColumn("proof", "jsonb")
    .addColumn("verified", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_discourse_user_delegate_id",
      ["delegate_id"],
      "public.delegate",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_discourse_user_discourse_user_id",
      ["discourse_user_id"],
      "public.discourse_user",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for delegate_to_discourse_user
  await db.schema
    .createIndex("idx_delegate_to_discourse_user_delegate_id")
    .on("public.delegate_to_discourse_user")
    .column("delegate_id")
    .execute();
  await db.schema
    .createIndex("idx_delegate_to_discourse_user_discourse_user_id")
    .on("public.delegate_to_discourse_user")
    .column("discourse_user_id")
    .execute();
  await db.schema
    .createIndex("idx_delegate_to_discourse_user_period")
    .on("public.delegate_to_discourse_user")
    .columns(["period_start", "period_end"])
    .execute();

  await db.schema
    .createTable("public.voter")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("address", "text", (col) => col.notNull())
    .addColumn("ens", "text")
    .addColumn("avatar", "text")
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
  // Indexes for voter
  await db.schema
    .createIndex("idx_voter_address")
    .on("public.voter")
    .column("address")
    .execute();
  await db.schema
    .createIndex("voter_address_key")
    .on("public.voter")
    .column("address")
    .unique()
    .execute();

  await db.schema
    .createTable("public.delegate_to_voter")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("delegate_id", "uuid", (col) => col.notNull())
    .addColumn("voter_id", "uuid", (col) => col.notNull())
    .addColumn("period_start", "timestamp", (col) => col.notNull())
    .addColumn("period_end", "timestamp", (col) => col.notNull())
    .addColumn("proof", "jsonb")
    .addColumn("verified", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_voter_delegate_id",
      ["delegate_id"],
      "public.delegate",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_delegate_to_voter_voter_id",
      ["voter_id"],
      "public.voter",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for delegate_to_voter
  await db.schema
    .createIndex("idx_delegate_to_voter_delegate_id")
    .on("public.delegate_to_voter")
    .column("delegate_id")
    .execute();
  await db.schema
    .createIndex("idx_delegate_to_voter_period")
    .on("public.delegate_to_voter")
    .columns(["period_start", "period_end"])
    .execute();
  await db.schema
    .createIndex("idx_delegate_to_voter_voter_id")
    .on("public.delegate_to_voter")
    .column("voter_id")
    .execute();

  await db.schema
    .createTable("public.delegation")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("delegator", "text", (col) => col.notNull())
    .addColumn("delegate", "text", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("timestamp", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("block", "integer", (col) => col.notNull())
    .addColumn("txid", "text")
    .addForeignKeyConstraint(
      "fk_delegation_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for delegation
  await db.schema
    .createIndex("idx_delegation_block")
    .on("public.delegation")
    .column("block")
    .execute();
  await db.schema
    .createIndex("idx_delegation_delegate")
    .on("public.delegation")
    .column("delegate")
    .execute();
  await db.schema
    .createIndex("idx_delegation_delegate_block")
    .on("public.delegation")
    .columns(["delegate", "block"])
    .execute();
  await db.schema
    .createIndex("idx_delegation_delegate_timestamp")
    .on("public.delegation")
    .columns(["delegate", "timestamp"])
    .execute();
  await db.schema
    .createIndex("idx_delegation_delegator")
    .on("public.delegation")
    .column("delegator")
    .execute();
  await db.schema
    .createIndex("idx_delegation_timestamp")
    .on("public.delegation")
    .column("timestamp")
    .execute();
  await db.schema
    .createIndex("uq_delegation_txid")
    .on("public.delegation")
    .column("txid")
    .unique()
    .execute();

  await db.schema
    .createTable("public.discourse_category")
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
      "public.dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for discourse_category
  await db.schema
    .createIndex("idx_discourse_category_external_id")
    .on("public.discourse_category")
    .column("external_id")
    .execute();
  await db.schema
    .createIndex("uq_discourse_category_external_id_dao_discourse_id")
    .on("public.discourse_category")
    .columns(["external_id", "dao_discourse_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("public.discourse_post")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "integer", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("cooked", "text")
    .addColumn("post_number", "integer", (col) => col.notNull())
    .addColumn("post_type", "integer", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .addColumn("reply_count", "integer", (col) => col.notNull())
    .addColumn("reply_to_post_number", "integer")
    .addColumn("quote_count", "integer", (col) => col.notNull())
    .addColumn("incoming_link_count", "integer", (col) => col.notNull())
    .addColumn("reads", "integer", (col) => col.notNull())
    .addColumn("readers_count", "integer", (col) => col.notNull())
    .addColumn("score", "float8", (col) => col.notNull()) // double precision -> float8
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
    .addColumn("can_view_edit_history", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addForeignKeyConstraint(
      "fk_discourse_post_dao_discourse_id",
      ["dao_discourse_id"],
      "public.dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for discourse_post
  await db.schema
    .createIndex("idx_discourse_post_external_id")
    .on("public.discourse_post")
    .column("external_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_topic_dao_discourse_post_number")
    .on("public.discourse_post")
    .columns(["topic_id", "dao_discourse_id", "post_number"])
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_topic_id")
    .on("public.discourse_post")
    .column("topic_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_user_id")
    .on("public.discourse_post")
    .column("user_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_version")
    .on("public.discourse_post")
    .column("version")
    .execute();
  await db.schema
    .createIndex("uq_discourse_post_external_id_dao_discourse_id")
    .on("public.discourse_post")
    .columns(["external_id", "dao_discourse_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("public.discourse_post_like")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_discourse_post_id", "integer", (col) => col.notNull())
    .addColumn("external_user_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_discourse_post_like_dao_discourse_id",
      ["dao_discourse_id"],
      "public.dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for discourse_post_like
  await db.schema
    .createIndex("idx_discourse_post_like_created_at")
    .on("public.discourse_post_like")
    .column("created_at")
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_like_external_user_id")
    .on("public.discourse_post_like")
    .column("external_user_id")
    .execute();
  await db.schema
    .createIndex("idx_external_discourse_post_like_post_id")
    .on("public.discourse_post_like")
    .column("external_discourse_post_id")
    .execute();
  await db.schema
    .createIndex("uq_external_discourse_post_like_post_user_dao")
    .on("public.discourse_post_like")
    .columns([
      "external_discourse_post_id",
      "external_user_id",
      "dao_discourse_id",
    ])
    .unique()
    .execute();

  await db.schema
    .createTable("public.discourse_post_revision")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("discourse_post_id", "uuid", (col) => col.notNull())
    .addColumn("external_post_id", "integer", (col) => col.notNull())
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("username", "text", (col) => col.notNull())
    .addColumn("body_changes", "text", (col) => col.notNull())
    .addColumn("edit_reason", "text")
    .addColumn("dao_discourse_id", "uuid", (col) => col.notNull())
    .addColumn("title_changes", "text")
    .addColumn("cooked_body_before", "text")
    .addColumn("cooked_title_before", "text")
    .addColumn("cooked_body_after", "text")
    .addColumn("cooked_title_after", "text")
    .addForeignKeyConstraint(
      "fk_discourse_post_revision_dao_discourse_id",
      ["dao_discourse_id"],
      "public.dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_discourse_post_revision_discourse_post_id",
      ["discourse_post_id"],
      "public.discourse_post",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for discourse_post_revision
  await db.schema
    .createIndex("idx_discourse_post_revision_discourse_post_id")
    .on("public.discourse_post_revision")
    .column("discourse_post_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_revision_external_post_id")
    .on("public.discourse_post_revision")
    .column("external_post_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_post_revision_version")
    .on("public.discourse_post_revision")
    .column("version")
    .execute();
  await db.schema
    .createIndex(
      "uq_discourse_post_revision_external_post_id_version_dao_discour",
    )
    .on("public.discourse_post_revision")
    .columns(["external_post_id", "version", "dao_discourse_id"])
    .unique()
    .execute();
  await db.schema
    .createIndex("uq_discourse_post_revision_post_version")
    .on("public.discourse_post_revision")
    .columns(["discourse_post_id", "version"])
    .unique()
    .execute();

  await db.schema
    .createTable("public.discourse_topic")
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
      "public.dao_discourse",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for discourse_topic
  await db.schema
    .createIndex("idx_discourse_topic_category_id")
    .on("public.discourse_topic")
    .column("category_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_topic_external_id")
    .on("public.discourse_topic")
    .column("external_id")
    .execute();
  await db.schema
    .createIndex("idx_discourse_topic_external_id_dao_discourse_id")
    .on("public.discourse_topic")
    .columns(["external_id", "dao_discourse_id"])
    .execute();
  await db.schema
    .createIndex("uq_discourse_topic_external_id_dao_discourse_id")
    .on("public.discourse_topic")
    .columns(["external_id", "dao_discourse_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("public.proposal")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("external_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("discussion_url", "text")
    .addColumn("choices", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("quorum", "float8", (col) => col.notNull()) // double precision -> float8
    .addColumn("proposal_state", sql`public.proposal_state`, (col) =>
      col.notNull(),
    )
    .addColumn("marked_spam", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("start_at", "timestamp", (col) => col.notNull())
    .addColumn("end_at", "timestamp", (col) => col.notNull())
    .addColumn("block_created_at", "integer")
    .addColumn("txid", "text")
    .addColumn("metadata", "jsonb")
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("author", "text")
    .addColumn("governor_id", "uuid", (col) => col.notNull())
    .addColumn("block_start_at", "integer")
    .addColumn("block_end_at", "integer")
    .addForeignKeyConstraint(
      "fk_proposal_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_proposal_governor_id",
      ["governor_id"],
      "public.dao_governor",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for proposal
  await db.schema
    .createIndex("idx_proposal_block_end_at")
    .on("public.proposal")
    .column("block_end_at")
    .execute();
  await db.schema
    .createIndex("idx_proposal_block_start_at")
    .on("public.proposal")
    .column("block_start_at")
    .execute();
  await db.schema
    .createIndex("idx_proposal_external_id_governor_id")
    .on("public.proposal")
    .columns(["external_id", "governor_id"])
    .execute();
  await db.schema
    .createIndex("idx_proposal_new_dao_id")
    .on("public.proposal")
    .column("dao_id")
    .execute();
  await db.schema
    .createIndex("idx_proposal_new_governor_id")
    .on("public.proposal")
    .column("governor_id")
    .execute();
  await db.schema
    .createIndex("idx_proposal_new_proposal_state")
    .on("public.proposal")
    .column("proposal_state")
    .execute();
  await db.schema
    .createIndex("idx_proposal_new_time_end")
    .on("public.proposal")
    .column("end_at")
    .execute();
  await db.schema
    .createIndex("idx_proposal_new_time_start")
    .on("public.proposal")
    .column("start_at")
    .execute();
  await db.schema
    .createIndex("proposal_new_pkey")
    .on("public.proposal")
    .column("id")
    .unique()
    .execute();
  await db.schema
    .createIndex("proposal_new_txid_key")
    .on("public.proposal")
    .column("txid")
    .unique()
    .execute();

  await db.schema
    .createTable("public.proposal_group")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("items", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_proposal_group_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for proposal_group
  await db.schema
    .createIndex("idx_proposal_group_dao_id")
    .on("public.proposal_group")
    .column("dao_id")
    .execute();
  await db.schema
    .createIndex("idx_proposal_group_items")
    .on("public.proposal_group")
    .column("items")
    .execute();

  await db.schema
    .createTable("public.vote")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("voter_address", "text", (col) => col.notNull())
    .addColumn("choice", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("voting_power", "float8", (col) => col.notNull()) // double precision -> float8
    .addColumn("reason", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("block_created_at", "integer")
    .addColumn("txid", "text")
    .addColumn("proposal_external_id", "text", (col) => col.notNull())
    .addColumn("proposal_id", "uuid", (col) => col.notNull())
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("governor_id", "uuid", (col) => col.notNull())
    .addForeignKeyConstraint(
      "fk_vote_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_governor_id",
      ["governor_id"],
      "public.dao_governor",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_proposal_id",
      ["proposal_id"],
      "public.proposal",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_vote_voter_address",
      ["voter_address"],
      "public.voter",
      ["address"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for vote
  await db.schema
    .createIndex("idx_vote_created_at")
    .on("public.vote")
    .column("created_at")
    .execute();
  await db.schema
    .createIndex("idx_vote_external_id_governor_id")
    .on("public.vote")
    .columns(["proposal_external_id", "governor_id"])
    .execute();
  await db.schema
    .createIndex("idx_vote_new_dao_id")
    .on("public.vote")
    .column("dao_id")
    .execute();
  await db.schema
    .createIndex("idx_vote_new_governor_id")
    .on("public.vote")
    .column("governor_id")
    .execute();
  await db.schema
    .createIndex("idx_vote_new_proposal_id")
    .on("public.vote")
    .column("proposal_id")
    .execute();
  await db.schema
    .createIndex("idx_vote_new_voter_address")
    .on("public.vote")
    .column("voter_address")
    .execute();
  await db.schema
    .createIndex("idx_vote_proposal_id_voter_address")
    .on("public.vote")
    .columns(["proposal_id", "voter_address"])
    .execute();
  await db.schema
    .createIndex("unique_vote_new")
    .on("public.vote")
    .columns(["proposal_id", "voter_address", "created_at"])
    .unique()
    .execute();
  await db.schema
    .createIndex("vote_new_pkey")
    .on("public.vote")
    .column("id")
    .unique()
    .execute();

  await db.schema
    .createTable("public.voting_power")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("voter", "text", (col) => col.notNull())
    .addColumn("voting_power", "float8", (col) => col.notNull()) // double precision -> float8
    .addColumn("dao_id", "uuid", (col) => col.notNull())
    .addColumn("timestamp", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("block", "integer", (col) => col.notNull())
    .addColumn("txid", "text")
    .addForeignKeyConstraint(
      "fk_voting_power_dao_id",
      ["dao_id"],
      "public.dao",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();
  // Indexes for voting_power
  await db.schema
    .createIndex("idx_voting_power_block")
    .on("public.voting_power")
    .column("block")
    .execute();
  await db.schema
    .createIndex("idx_voting_power_dao_id_voter_timestamp_voting_power")
    .on("public.voting_power")
    .columns(["dao_id", "voter", "timestamp", "voting_power"])
    .execute();
  await db.schema
    .createIndex("idx_voting_power_dao_voter_ts_desc")
    .on("public.voting_power")
    .columns(["dao_id", "voter", "timestamp desc"])
    .execute();
  await db.schema
    .createIndex("idx_voting_power_timestamp")
    .on("public.voting_power")
    .column("timestamp")
    .execute();
  await db.schema
    .createIndex("idx_voting_power_voter")
    .on("public.voting_power")
    .column("voter")
    .execute();
  await db.schema
    .createIndex("idx_voting_power_voter_block")
    .on("public.voting_power")
    .columns(["voter", "block"])
    .execute();
  await db.schema
    .createIndex("idx_voting_power_voter_timestamp")
    .on("public.voting_power")
    .columns(["voter", "timestamp"])
    .execute();
  await db.schema
    .createIndex("uq_voting_power_txid")
    .on("public.voting_power")
    .column("txid")
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // --- DROP TABLES (Reverse order of creation, considering dependencies) ---

  // public schema tables (children first)
  await db.schema.dropTable("public.voting_power").ifExists().execute();
  await db.schema.dropTable("public.vote").ifExists().execute();
  await db.schema.dropTable("public.proposal_group").ifExists().execute();
  await db.schema.dropTable("public.proposal").ifExists().execute();
  await db.schema
    .dropTable("public.discourse_post_revision")
    .ifExists()
    .execute();
  await db.schema.dropTable("public.discourse_post_like").ifExists().execute();
  await db.schema.dropTable("public.discourse_post").ifExists().execute();
  await db.schema.dropTable("public.discourse_topic").ifExists().execute();
  await db.schema.dropTable("public.discourse_category").ifExists().execute();
  await db.schema.dropTable("public.delegate_to_voter").ifExists().execute();
  await db.schema
    .dropTable("public.delegate_to_discourse_user")
    .ifExists()
    .execute();
  await db.schema.dropTable("public.discourse_user").ifExists().execute();
  await db.schema.dropTable("public.voter").ifExists().execute();
  await db.schema.dropTable("public.delegation").ifExists().execute();
  await db.schema.dropTable("public.delegate").ifExists().execute();
  await db.schema.dropTable("public.dao_governor").ifExists().execute();
  await db.schema.dropTable("public.dao_discourse").ifExists().execute();
  await db.schema.dropTable("public.dao").ifExists().execute();
  await db.schema.dropTable("public.job_queue").ifExists().execute();

  // --- DROP ENUM TYPES ---
  await db.schema.dropType("public.proposal_state").ifExists().execute();
}
