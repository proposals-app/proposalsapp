import { sql, type Kysely } from 'kysely';
import type { DB } from '../src/kysely_db';

export async function up(db: Kysely<DB>): Promise<void> {
  // ============================================================================
  // COMPREHENSIVE INDEXING STRATEGY FOR COMPLEX GETGROUPS QUERY
  // Based on PostgreSQL best practices research for JSONB, lateral joins,
  // covering indexes, and complex aggregations (2024)
  // ============================================================================

  // ===== CORE PROPOSAL_GROUP INDEXES =====

  // CRITICAL: Most selective filter - proposal_group by daoId and name
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_group_dao_id_name
    ON public.proposal_group(dao_id, name)
    WHERE name != 'UNGROUPED';
  `.execute(db);

  // CRITICAL: JSONB containment queries (jsonb_path_ops for smaller size and better performance)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_group_items_containment
    ON public.proposal_group USING gin (items jsonb_path_ops)
    WHERE name != 'UNGROUPED';
  `.execute(db);

  // PERFORMANCE: Additional GIN index for specific JSONB operations
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_group_items_gin_full
    ON public.proposal_group USING gin (items)
    WHERE name != 'UNGROUPED';
  `.execute(db);

  // ===== ENHANCED PROPOSAL INDEXES =====

  // CRITICAL: Enhanced proposal tuple lookup with comprehensive covering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_external_governor_complete_covering
    ON public.proposal(external_id, governor_id)
    INCLUDE (id, author, created_at, end_at, proposal_state, dao_id, name);
  `.execute(db);

  // CRITICAL: Time-based proposal filtering for active proposal detection
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_time_based_filtering
    ON public.proposal(end_at, created_at, proposal_state)
    INCLUDE (id, external_id, governor_id, author)
    WHERE proposal_state IN ('ACTIVE', 'PENDING');
  `.execute(db);

  // PERFORMANCE: Author-based proposal ordering (for earliest author queries)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_author_created_at_ordering
    ON public.proposal(created_at, author)
    INCLUDE (id, external_id, governor_id)
    WHERE author IS NOT NULL;
  `.execute(db);

  // ===== ENHANCED VOTE INDEXES =====

  // CRITICAL: Enhanced vote aggregation with covering index
  await sql`
    CREATE INDEX IF NOT EXISTS idx_vote_proposal_enhanced_aggregation
    ON public.vote(proposal_id)
    INCLUDE (id, created_at, voter_address, voting_power, choice);
  `.execute(db);

  // PERFORMANCE: Vote filtering by proposal state relationship
  await sql`
    CREATE INDEX IF NOT EXISTS idx_vote_proposal_dao_lookup
    ON public.vote(proposal_id, dao_id)
    INCLUDE (id, voter_address, voting_power);
  `.execute(db);

  // ===== ENHANCED DISCOURSE TOPIC INDEXES =====

  // CRITICAL: Enhanced discourse topic tuple lookup with comprehensive covering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_topic_external_dao_complete_covering
    ON public.discourse_topic(external_id, dao_discourse_id)
    INCLUDE (id, created_at, bumped_at, posts_count, category_id, title);
  `.execute(db);

  // PERFORMANCE: Topic activity ordering (for latest activity detection)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_topic_activity_ordering
    ON public.discourse_topic(bumped_at DESC, created_at DESC)
    INCLUDE (id, posts_count, dao_discourse_id);
  `.execute(db);

  // ===== ENHANCED DISCOURSE POST INDEXES =====

  // CRITICAL: Enhanced first post lookup with comprehensive covering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_post_first_post_complete_covering
    ON public.discourse_post(topic_id, dao_discourse_id, post_number)
    INCLUDE (user_id, created_at, id, username)
    WHERE post_number = 1;
  `.execute(db);

  // PERFORMANCE: User-based post lookup for author chain optimization
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_post_user_topic_lookup
    ON public.discourse_post(user_id, dao_discourse_id, topic_id)
    INCLUDE (post_number, created_at)
    WHERE post_number = 1;
  `.execute(db);

  // ===== ENHANCED DISCOURSE USER INDEXES =====

  // CRITICAL: Enhanced discourse user lookup with comprehensive covering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_user_complete_covering
    ON public.discourse_user(external_id, dao_discourse_id)
    INCLUDE (username, avatar_template, id, name);
  `.execute(db);

  // PERFORMANCE: Username-based lookups for author resolution
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discourse_user_username_lookup
    ON public.discourse_user(username, dao_discourse_id)
    INCLUDE (external_id, avatar_template);
  `.execute(db);

  // ===== USER-SPECIFIC INDEXES FOR READ TRACKING =====

  // CRITICAL: User proposal group read tracking (Arbitrum)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_arbitrum_user_proposal_group_last_read_lookup
    ON arbitrum.user_proposal_group_last_read(user_id, proposal_group_id)
    INCLUDE (last_read_at);
  `.execute(db);

  // CRITICAL: User proposal group read tracking (Uniswap)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_uniswap_user_proposal_group_last_read_lookup
    ON uniswap.user_proposal_group_last_read(user_id, proposal_group_id)
    INCLUDE (last_read_at);
  `.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop all indexes in reverse order of creation

  // User-specific indexes
  await sql`DROP INDEX IF EXISTS uniswap.idx_uniswap_user_proposal_group_last_read_lookup;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS arbitrum.idx_arbitrum_user_proposal_group_last_read_lookup;`.execute(
    db
  );

  // Discourse user indexes
  await sql`DROP INDEX IF EXISTS public.idx_discourse_user_username_lookup;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_discourse_user_complete_covering;`.execute(
    db
  );

  // Discourse post indexes
  await sql`DROP INDEX IF EXISTS public.idx_discourse_post_user_topic_lookup;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_discourse_post_first_post_complete_covering;`.execute(
    db
  );

  // Discourse topic indexes
  await sql`DROP INDEX IF EXISTS public.idx_discourse_topic_activity_ordering;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_discourse_topic_external_dao_complete_covering;`.execute(
    db
  );

  // Vote indexes
  await sql`DROP INDEX IF EXISTS public.idx_vote_proposal_dao_lookup;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_vote_proposal_enhanced_aggregation;`.execute(
    db
  );

  // Proposal indexes
  await sql`DROP INDEX IF EXISTS public.idx_proposal_author_created_at_ordering;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_proposal_time_based_filtering;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_proposal_external_governor_complete_covering;`.execute(
    db
  );

  // JSONB indexes
  await sql`DROP INDEX IF EXISTS public.idx_proposal_group_items_gin_full;`.execute(
    db
  );

  // Core proposal_group indexes
  await sql`DROP INDEX IF EXISTS public.idx_proposal_group_items_containment;`.execute(
    db
  );
  await sql`DROP INDEX IF EXISTS public.idx_proposal_group_dao_id_name;`.execute(
    db
  );
}
