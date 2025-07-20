import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
  // Check if pg_background is available without trying to create it
  // This avoids transaction issues if the extension cannot be created
  let pgBackgroundAvailable = false;

  try {
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_background'
      ) as exists
    `.execute(db);

    pgBackgroundAvailable = result.rows[0]?.exists ?? false;

    if (!pgBackgroundAvailable) {
      console.log(
        'pg_background extension not installed, falling back to smart refresh with debouncing'
      );
    }
  } catch {
    console.log(
      'Could not check for pg_background extension, falling back to smart refresh with debouncing'
    );
  }

  // ========================================
  // 1. CREATE MATERIALIZED VIEWS
  // ========================================

  // Create materialized view for group summary data
  await sql`
    CREATE MATERIALIZED VIEW proposal_group_summary AS
    WITH proposal_stats AS (
      SELECT
        pg.id as group_id,
        COUNT(DISTINCT p.id) as proposal_count,
        COALESCE(SUM(vote_counts.vote_count), 0) as total_votes,
        MAX(p.created_at) as latest_proposal_created,
        MIN(CASE WHEN p.end_at > NOW() THEN p.end_at END) as earliest_active_end,
        bool_or(p.end_at > NOW()) as has_active_proposal,
        MIN(p.created_at) as earliest_proposal_created,
        (array_agg(p.author ORDER BY p.created_at))[1] as earliest_proposal_author
      FROM proposal_group pg
      CROSS JOIN LATERAL jsonb_array_elements(pg.items) AS item
      LEFT JOIN proposal p ON
        p.external_id = item->>'externalId' AND
        p.governor_id = (item->>'governorId')::uuid AND
        item->>'type' = 'proposal'
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as vote_count
        FROM vote v
        WHERE v.proposal_id = p.id
      ) vote_counts ON p.id IS NOT NULL
      GROUP BY pg.id
    ),
    topic_stats AS (
      SELECT
        pg.id as group_id,
        COUNT(DISTINCT dt.id) as topic_count,
        COALESCE(SUM(dt.posts_count), 0) as total_posts,
        COALESCE(SUM(GREATEST(dt.posts_count - 1, 0)), 0) as total_posts_excluding_first,
        MAX(dt.bumped_at) as latest_topic_activity,
        MIN(dt.created_at) as earliest_topic_created,
        (array_agg(du.username ORDER BY dt.created_at) FILTER (WHERE du.username IS NOT NULL))[1] as earliest_topic_author,
        (array_agg(du.avatar_template ORDER BY dt.created_at) FILTER (WHERE du.avatar_template IS NOT NULL))[1] as earliest_topic_author_avatar
      FROM proposal_group pg
      CROSS JOIN LATERAL jsonb_array_elements(pg.items) AS item
      LEFT JOIN discourse_topic dt ON
        dt.external_id::text = (item->>'externalId') AND
        dt.dao_discourse_id = (item->>'daoDiscourseId')::uuid AND
        item->>'type' = 'topic'
      LEFT JOIN discourse_post dp ON
        dp.topic_id = dt.external_id AND
        dp.dao_discourse_id = dt.dao_discourse_id AND
        dp.post_number = 1
      LEFT JOIN discourse_user du ON
        du.external_id = dp.user_id AND
        du.dao_discourse_id = dp.dao_discourse_id
      GROUP BY pg.id
    )
    SELECT
      pg.id,
      pg.name,
      pg.dao_id,
      pg.created_at as group_created_at,
      COALESCE(ps.proposal_count, 0) as proposals_count,
      COALESCE(ts.topic_count, 0) as topics_count,
      COALESCE(ps.total_votes, 0) as votes_count,
      COALESCE(ts.total_posts_excluding_first, 0) as posts_count,
      COALESCE(
        GREATEST(ps.latest_proposal_created, ts.latest_topic_activity),
        ps.latest_proposal_created,
        ts.latest_topic_activity,
        pg.created_at
      ) as latest_activity_at,
      COALESCE(ps.has_active_proposal, false) as has_active_proposal,
      ps.earliest_active_end as earliest_end_time,
      COALESCE(
        CASE
          WHEN ps.earliest_proposal_created IS NOT NULL AND ts.earliest_topic_created IS NOT NULL
          THEN
            CASE WHEN ps.earliest_proposal_created < ts.earliest_topic_created
            THEN ps.earliest_proposal_author
            ELSE ts.earliest_topic_author
            END
          WHEN ps.earliest_proposal_created IS NOT NULL THEN ps.earliest_proposal_author
          WHEN ts.earliest_topic_created IS NOT NULL THEN ts.earliest_topic_author
        END,
        'Unknown'
      ) as author_name,
      COALESCE(
        CASE
          WHEN ps.earliest_proposal_created IS NOT NULL AND ts.earliest_topic_created IS NOT NULL
          THEN
            CASE WHEN ps.earliest_proposal_created < ts.earliest_topic_created
            THEN 'https://api.dicebear.com/9.x/pixel-art/png?seed=' || COALESCE(ps.earliest_proposal_author, 'unknown')
            ELSE REPLACE(ts.earliest_topic_author_avatar, '{size}', '240')
            END
          WHEN ps.earliest_proposal_created IS NOT NULL
          THEN 'https://api.dicebear.com/9.x/pixel-art/png?seed=' || COALESCE(ps.earliest_proposal_author, 'unknown')
          WHEN ts.earliest_topic_created IS NOT NULL AND ts.earliest_topic_author_avatar IS NOT NULL
          THEN REPLACE(ts.earliest_topic_author_avatar, '{size}', '240')
          WHEN ts.earliest_topic_created IS NOT NULL
          THEN 'https://api.dicebear.com/9.x/pixel-art/png?seed=' || COALESCE(ts.earliest_topic_author, 'unknown')
        END,
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app'
      ) as author_avatar_url
    FROM proposal_group pg
    LEFT JOIN proposal_stats ps ON ps.group_id = pg.id
    LEFT JOIN topic_stats ts ON ts.group_id = pg.id
    WHERE pg.name != 'UNGROUPED'
  `.execute(db);

  // Create materialized view for votes with all voter information
  await sql`
    CREATE MATERIALIZED VIEW proposal_votes_with_voters AS
    WITH latest_voting_power AS (
      SELECT DISTINCT ON (voter, dao_id)
        voter,
        dao_id,
        voting_power,
        timestamp
      FROM voting_power
      ORDER BY voter, dao_id, timestamp DESC
    ),
    discourse_links AS (
      SELECT DISTINCT ON (dtv.voter_id)
        dtv.voter_id,
        dtv.delegate_id,
        dtdu.discourse_user_id,
        du.username as discourse_username,
        du.avatar_template as discourse_avatar_template,
        d.dao_id
      FROM delegate_to_voter dtv
      INNER JOIN delegate d ON d.id = dtv.delegate_id
      LEFT JOIN delegate_to_discourse_user dtdu ON dtdu.delegate_id = dtv.delegate_id
      LEFT JOIN discourse_user du ON du.id = dtdu.discourse_user_id
      ORDER BY dtv.voter_id, dtv.created_at DESC
    )
    SELECT
      v.id as vote_id,
      v.voter_address,
      v.choice,
      v.voting_power,
      v.reason,
      v.created_at,
      v.block_created_at,
      v.txid,
      v.proposal_id,
      v.proposal_external_id,
      v.dao_id,
      v.governor_id,
      voter.id as voter_id,
      voter.ens,
      voter.avatar,
      lvp.voting_power as latest_voting_power,
      dl.discourse_username,
      dl.discourse_avatar_template,
      COALESCE(
        voter.avatar,
        dl.discourse_avatar_template,
        'https://api.dicebear.com/9.x/pixel-art/png?seed=' || v.voter_address
      ) as computed_avatar
    FROM vote v
    INNER JOIN voter ON voter.address = v.voter_address
    LEFT JOIN latest_voting_power lvp ON lvp.voter = v.voter_address AND lvp.dao_id = v.dao_id
    LEFT JOIN discourse_links dl ON dl.voter_id = voter.id AND dl.dao_id = v.dao_id
  `.execute(db);

  // Create materialized view for non-voters
  await sql`
    CREATE MATERIALIZED VIEW proposal_non_voters AS
    WITH proposal_info AS (
      SELECT
        p.id as proposal_id,
        p.dao_id,
        p.start_at,
        p.end_at,
        p.governor_id
      FROM proposal p
    ),
    voted_addresses AS (
      SELECT DISTINCT
        proposal_id,
        voter_address
      FROM vote
    ),
    eligible_voters_at_start AS (
      SELECT DISTINCT ON (vp.voter, pi.proposal_id)
        pi.proposal_id,
        pi.dao_id,
        vp.voter as voter_address,
        vp.voting_power as voting_power_at_start,
        v.id as voter_id,
        v.ens,
        v.avatar
      FROM proposal_info pi
      CROSS JOIN LATERAL (
        SELECT *
        FROM voting_power vp2
        WHERE vp2.dao_id = pi.dao_id
          AND vp2.timestamp <= pi.start_at
          AND vp2.voting_power > 0
        ORDER BY vp2.voter, vp2.timestamp DESC
      ) vp
      INNER JOIN voter v ON v.address = vp.voter
      ORDER BY vp.voter, pi.proposal_id, vp.timestamp DESC
    ),
    latest_voting_power AS (
      SELECT DISTINCT ON (voter, dao_id)
        voter,
        dao_id,
        voting_power as current_voting_power
      FROM voting_power
      ORDER BY voter, dao_id, timestamp DESC
    ),
    discourse_links AS (
      SELECT DISTINCT ON (dtv.voter_id)
        dtv.voter_id,
        dtv.delegate_id,
        dtdu.discourse_user_id,
        du.username as discourse_username,
        du.avatar_template as discourse_avatar_template,
        d.dao_id
      FROM delegate_to_voter dtv
      INNER JOIN delegate d ON d.id = dtv.delegate_id
      LEFT JOIN delegate_to_discourse_user dtdu ON dtdu.delegate_id = dtv.delegate_id
      LEFT JOIN discourse_user du ON du.id = dtdu.discourse_user_id
      ORDER BY dtv.voter_id, dtv.created_at DESC
    )
    SELECT
      ev.proposal_id,
      ev.dao_id,
      ev.voter_address,
      ev.voter_id,
      ev.voting_power_at_start,
      ev.ens,
      ev.avatar,
      COALESCE(lvp.current_voting_power, 0) as current_voting_power,
      dl.discourse_username,
      dl.discourse_avatar_template,
      COALESCE(
        ev.avatar,
        dl.discourse_avatar_template,
        'https://api.dicebear.com/9.x/pixel-art/png?seed=' || ev.voter_address
      ) as computed_avatar
    FROM eligible_voters_at_start ev
    LEFT JOIN voted_addresses va ON va.proposal_id = ev.proposal_id AND va.voter_address = ev.voter_address
    LEFT JOIN latest_voting_power lvp ON lvp.voter = ev.voter_address AND lvp.dao_id = ev.dao_id
    LEFT JOIN discourse_links dl ON dl.voter_id = ev.voter_id AND dl.dao_id = ev.dao_id
    WHERE va.voter_address IS NULL
      AND ev.voting_power_at_start > 0
  `.execute(db);

  // ========================================
  // 2. CREATE INDEXES
  // ========================================

  // Indexes for proposal_group_summary
  await sql`
    CREATE INDEX idx_proposal_group_summary_dao_id
    ON proposal_group_summary(dao_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_proposal_group_summary_latest_activity
    ON proposal_group_summary(dao_id, latest_activity_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX idx_proposal_group_summary_active_proposals
    ON proposal_group_summary(dao_id, has_active_proposal, earliest_end_time)
    WHERE has_active_proposal = true
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX idx_proposal_group_summary_id
    ON proposal_group_summary(id)
  `.execute(db);

  // Indexes for proposal_votes_with_voters
  await sql`
    CREATE INDEX idx_proposal_votes_with_voters_proposal_id
    ON proposal_votes_with_voters(proposal_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_proposal_votes_with_voters_dao_id
    ON proposal_votes_with_voters(dao_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_proposal_votes_with_voters_voter_address
    ON proposal_votes_with_voters(voter_address)
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX idx_proposal_votes_with_voters_vote_id
    ON proposal_votes_with_voters(vote_id)
  `.execute(db);

  // Indexes for proposal_non_voters
  await sql`
    CREATE INDEX idx_proposal_non_voters_proposal_id
    ON proposal_non_voters(proposal_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_proposal_non_voters_dao_id
    ON proposal_non_voters(dao_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_proposal_non_voters_voting_power
    ON proposal_non_voters(proposal_id, voting_power_at_start DESC)
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX idx_proposal_non_voters_unique
    ON proposal_non_voters(proposal_id, voter_address)
  `.execute(db);

  // ========================================
  // 3. CREATE REFRESH FUNCTIONS AND TRIGGERS
  // ========================================

  // Create base refresh functions
  await sql`
    CREATE OR REPLACE FUNCTION refresh_proposal_group_summary()
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_group_summary;
    END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION refresh_proposal_votes_with_voters()
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_votes_with_voters;
    END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION refresh_proposal_non_voters()
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_non_voters;
    END;
    $$
  `.execute(db);

  if (pgBackgroundAvailable) {
    console.log('Using pg_background for async materialized view refresh');

    // Create background refresh functions for each materialized view

    // 1. Proposal Group Summary
    await sql`
      CREATE OR REPLACE FUNCTION refresh_proposal_group_summary_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        result bigint;
      BEGIN
        -- Launch refresh in background worker
        SELECT pg_background_launch('REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_group_summary') INTO result;
        -- Detach immediately (non-blocking)
        PERFORM pg_background_detach(result);
        RETURN NULL;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the transaction
          RAISE WARNING 'Failed to refresh proposal_group_summary in background: %', SQLERRM;
          RETURN NULL;
      END;
      $$
    `.execute(db);

    // 2. Proposal Votes with Voters
    await sql`
      CREATE OR REPLACE FUNCTION refresh_proposal_votes_with_voters_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        result bigint;
      BEGIN
        -- Launch refresh in background worker
        SELECT pg_background_launch('REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_votes_with_voters') INTO result;
        -- Detach immediately (non-blocking)
        PERFORM pg_background_detach(result);
        RETURN NULL;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the transaction
          RAISE WARNING 'Failed to refresh proposal_votes_with_voters in background: %', SQLERRM;
          RETURN NULL;
      END;
      $$
    `.execute(db);

    // 3. Proposal Non Voters
    await sql`
      CREATE OR REPLACE FUNCTION refresh_proposal_non_voters_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        result bigint;
      BEGIN
        -- Launch refresh in background worker
        SELECT pg_background_launch('REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_non_voters') INTO result;
        -- Detach immediately (non-blocking)
        PERFORM pg_background_detach(result);
        RETURN NULL;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the transaction
          RAISE WARNING 'Failed to refresh proposal_non_voters in background: %', SQLERRM;
          RETURN NULL;
      END;
      $$
    `.execute(db);

    // Combined refresh for vote views
    await sql`
      CREATE OR REPLACE FUNCTION refresh_vote_views_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        result1 bigint;
        result2 bigint;
      BEGIN
        -- Launch both refreshes in background workers
        SELECT pg_background_launch('REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_votes_with_voters') INTO result1;
        SELECT pg_background_launch('REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_non_voters') INTO result2;
        -- Detach immediately (non-blocking)
        PERFORM pg_background_detach(result1);
        PERFORM pg_background_detach(result2);
        RETURN NULL;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the transaction
          RAISE WARNING 'Failed to refresh vote views in background: %', SQLERRM;
          RETURN NULL;
      END;
      $$
    `.execute(db);
  } else {
    console.log(
      'pg_background not available, using smart refresh with debouncing'
    );

    // Create a table to track last refresh times
    await sql`
      CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
        view_name TEXT PRIMARY KEY,
        last_refresh TIMESTAMP NOT NULL DEFAULT NOW(),
        refresh_count BIGINT DEFAULT 0
      )
    `.execute(db);

    // Insert initial entries for our materialized views
    await sql`
      INSERT INTO materialized_view_refresh_log (view_name)
      VALUES
        ('proposal_group_summary'),
        ('proposal_votes_with_voters'),
        ('proposal_non_voters')
      ON CONFLICT (view_name) DO NOTHING
    `.execute(db);

    // Create smart refresh function with debouncing
    await sql`
      CREATE OR REPLACE FUNCTION smart_refresh_materialized_view(view_name TEXT, min_interval INTERVAL DEFAULT '30 seconds')
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        last_refresh_time TIMESTAMP;
        lock_key BIGINT;
      BEGIN
        -- Generate a unique lock key for this view
        lock_key := hashtext('refresh_' || view_name);

        -- Check last refresh time
        SELECT last_refresh INTO last_refresh_time
        FROM materialized_view_refresh_log
        WHERE materialized_view_refresh_log.view_name = smart_refresh_materialized_view.view_name;

        -- Only refresh if enough time has passed
        IF last_refresh_time IS NULL OR NOW() - last_refresh_time > min_interval THEN
          -- Try to acquire advisory lock to prevent concurrent refreshes
          IF pg_try_advisory_lock(lock_key) THEN
            BEGIN
              -- Update log first
              UPDATE materialized_view_refresh_log
              SET last_refresh = NOW(), refresh_count = refresh_count + 1
              WHERE materialized_view_refresh_log.view_name = smart_refresh_materialized_view.view_name;

              -- Perform the refresh
              EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);

              -- Release lock
              PERFORM pg_advisory_unlock(lock_key);

              RETURN TRUE;
            EXCEPTION
              WHEN OTHERS THEN
                -- Release lock on error
                PERFORM pg_advisory_unlock(lock_key);
                RAISE WARNING 'Failed to refresh %: %', view_name, SQLERRM;
                RETURN FALSE;
            END;
          END IF;
        END IF;

        RETURN FALSE;
      END;
      $$
    `.execute(db);

    // Create async functions that use smart refresh
    await sql`
      CREATE OR REPLACE FUNCTION refresh_proposal_group_summary_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM smart_refresh_materialized_view('proposal_group_summary', '30 seconds'::interval);
        RETURN NULL;
      END;
      $$
    `.execute(db);

    await sql`
      CREATE OR REPLACE FUNCTION refresh_proposal_votes_with_voters_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM smart_refresh_materialized_view('proposal_votes_with_voters', '15 seconds'::interval);
        RETURN NULL;
      END;
      $$
    `.execute(db);

    await sql`
      CREATE OR REPLACE FUNCTION refresh_proposal_non_voters_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM smart_refresh_materialized_view('proposal_non_voters', '15 seconds'::interval);
        RETURN NULL;
      END;
      $$
    `.execute(db);

    await sql`
      CREATE OR REPLACE FUNCTION refresh_vote_views_async()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM smart_refresh_materialized_view('proposal_votes_with_voters', '15 seconds'::interval);
        PERFORM smart_refresh_materialized_view('proposal_non_voters', '15 seconds'::interval);
        RETURN NULL;
      END;
      $$
    `.execute(db);
  }

  // ========================================
  // 4. CREATE TRIGGERS
  // ========================================

  // Triggers for proposal_group_summary
  await sql`
    CREATE TRIGGER trigger_refresh_on_proposal_group
    AFTER INSERT OR UPDATE OR DELETE ON proposal_group
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_proposal
    AFTER INSERT OR UPDATE OR DELETE ON proposal
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_vote_for_group_summary
    AFTER INSERT OR UPDATE OR DELETE ON vote
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_discourse_topic
    AFTER INSERT OR UPDATE OR DELETE ON discourse_topic
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  // Triggers for vote-related materialized views
  await sql`
    CREATE TRIGGER trigger_refresh_on_vote_change
    AFTER INSERT OR UPDATE OR DELETE ON vote
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_vote_views_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_voting_power_change
    AFTER INSERT OR UPDATE OR DELETE ON voting_power
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_vote_views_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_voter_change
    AFTER INSERT OR UPDATE ON voter
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_vote_views_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_delegate_to_voter_change
    AFTER INSERT OR UPDATE OR DELETE ON delegate_to_voter
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_vote_views_async()
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_refresh_on_delegate_to_discourse_user_change
    AFTER INSERT OR UPDATE OR DELETE ON delegate_to_discourse_user
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_vote_views_async()
  `.execute(db);

  // ========================================
  // 5. INITIAL REFRESH
  // ========================================

  // Refresh all materialized views once to ensure they're populated
  await sql`REFRESH MATERIALIZED VIEW proposal_group_summary`.execute(db);
  await sql`REFRESH MATERIALIZED VIEW proposal_votes_with_voters`.execute(db);
  await sql`REFRESH MATERIALIZED VIEW proposal_non_voters`.execute(db);
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop all triggers
  await sql`
    DROP TRIGGER IF EXISTS trigger_refresh_on_proposal_group ON proposal_group;
    DROP TRIGGER IF EXISTS trigger_refresh_on_proposal ON proposal;
    DROP TRIGGER IF EXISTS trigger_refresh_on_vote_for_group_summary ON vote;
    DROP TRIGGER IF EXISTS trigger_refresh_on_discourse_topic ON discourse_topic;
    DROP TRIGGER IF EXISTS trigger_refresh_on_vote_change ON vote;
    DROP TRIGGER IF EXISTS trigger_refresh_on_voting_power_change ON voting_power;
    DROP TRIGGER IF EXISTS trigger_refresh_on_voter_change ON voter;
    DROP TRIGGER IF EXISTS trigger_refresh_on_delegate_to_voter_change ON delegate_to_voter;
    DROP TRIGGER IF EXISTS trigger_refresh_on_delegate_to_discourse_user_change ON delegate_to_discourse_user;
  `.execute(db);

  // Drop all functions
  await sql`
    DROP FUNCTION IF EXISTS refresh_proposal_group_summary_async();
    DROP FUNCTION IF EXISTS refresh_proposal_votes_with_voters_async();
    DROP FUNCTION IF EXISTS refresh_proposal_non_voters_async();
    DROP FUNCTION IF EXISTS refresh_vote_views_async();
    DROP FUNCTION IF EXISTS refresh_proposal_group_summary();
    DROP FUNCTION IF EXISTS refresh_proposal_votes_with_voters();
    DROP FUNCTION IF EXISTS refresh_proposal_non_voters();
    DROP FUNCTION IF EXISTS smart_refresh_materialized_view(TEXT, INTERVAL);
  `.execute(db);

  // Drop refresh log table if it exists
  await sql`DROP TABLE IF EXISTS materialized_view_refresh_log`.execute(db);

  // Drop all materialized views
  await sql`DROP MATERIALIZED VIEW IF EXISTS proposal_non_voters`.execute(db);
  await sql`DROP MATERIALIZED VIEW IF EXISTS proposal_votes_with_voters`.execute(
    db
  );
  await sql`DROP MATERIALIZED VIEW IF EXISTS proposal_group_summary`.execute(
    db
  );
}
