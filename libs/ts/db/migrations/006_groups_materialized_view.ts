import { type Kysely, sql } from 'kysely';
import { type DB } from '../src';

export async function up(db: Kysely<DB>): Promise<void> {
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

  // Create indexes on the materialized view
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

  // Create a unique index on id to allow concurrent refresh
  await sql`
    CREATE UNIQUE INDEX idx_proposal_group_summary_id
    ON proposal_group_summary(id)
  `.execute(db);

  // Create a function to refresh the materialized view
  // This can be called from application code or scheduled jobs
  await sql`
    CREATE OR REPLACE FUNCTION refresh_proposal_group_summary()
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Use CONCURRENTLY to avoid locking the view during refresh
      -- This requires the unique index we created on the id column
      REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_group_summary;
    END;
    $$
  `.execute(db);

  // Create a function that will be called by triggers to refresh the view
  await sql`
    CREATE OR REPLACE FUNCTION refresh_proposal_group_summary_async()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Use pg_notify to send a notification that can be handled by a listener
      -- This avoids blocking the transaction
      PERFORM pg_notify('refresh_proposal_group_summary', '');
      RETURN NULL;
    END;
    $$
  `.execute(db);

  // Create triggers on the relevant tables to refresh the view when data changes

  // Trigger for proposal_group changes
  await sql`
    CREATE TRIGGER trigger_refresh_on_proposal_group
    AFTER INSERT OR UPDATE OR DELETE ON proposal_group
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  // Trigger for proposal changes
  await sql`
    CREATE TRIGGER trigger_refresh_on_proposal
    AFTER INSERT OR UPDATE OR DELETE ON proposal
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  // Trigger for vote changes
  await sql`
    CREATE TRIGGER trigger_refresh_on_vote
    AFTER INSERT OR UPDATE OR DELETE ON vote
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  // Trigger for discourse_topic changes
  await sql`
    CREATE TRIGGER trigger_refresh_on_discourse_topic
    AFTER INSERT OR UPDATE OR DELETE ON discourse_topic
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_proposal_group_summary_async()
  `.execute(db);

  // Note: We don't need triggers on discourse_post and discourse_user
  // because only the first post matters (which would require row-level triggers)
  // and discourse_user changes are not critical for the summary view

  // Note: You'll need a background process listening for 'refresh_proposal_group_summary' notifications
  // Example listener in Node.js:
  // pg.on('notification', (msg) => {
  //   if (msg.channel === 'refresh_proposal_group_summary') {
  //     db.raw('SELECT refresh_proposal_group_summary()').execute();
  //   }
  // });
}

export async function down(db: Kysely<DB>): Promise<void> {
  // Drop triggers
  await sql`DROP TRIGGER IF EXISTS trigger_refresh_on_proposal_group ON proposal_group`.execute(
    db
  );
  await sql`DROP TRIGGER IF EXISTS trigger_refresh_on_proposal ON proposal`.execute(
    db
  );
  await sql`DROP TRIGGER IF EXISTS trigger_refresh_on_vote ON vote`.execute(db);
  await sql`DROP TRIGGER IF EXISTS trigger_refresh_on_discourse_topic ON discourse_topic`.execute(
    db
  );

  // Drop functions
  await sql`DROP FUNCTION IF EXISTS refresh_proposal_group_summary_async()`.execute(
    db
  );
  await sql`DROP FUNCTION IF EXISTS refresh_proposal_group_summary()`.execute(
    db
  );

  // Drop the materialized view
  await sql`DROP MATERIALIZED VIEW IF EXISTS proposal_group_summary`.execute(
    db
  );
}
