import {
  db,
  ProposalState,
  type Selectable,
  type Dao,
  type Kysely,
  type DB,
} from '@proposalsapp/db';
import { Resend } from 'resend';
import cron from 'node-cron';
import { formatDistanceStrict } from 'date-fns';
import { config as dotenv_config } from 'dotenv';
import { render } from '@react-email/render';
import {
  NewProposalEmailTemplate,
  NewDiscussionEmailTemplate,
  EndingProposalEmailTemplate,
} from '@proposalsapp/emails';
import { createServer } from 'http';

dotenv_config();

// Configuration - only what we actually need
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('Missing required environment variable: RESEND_API_KEY');
  process.exit(1);
}

const FROM_EMAIL =
  process.env.FROM_EMAIL || 'Proposals.app <no-reply@proposals.app>';
const NEW_PROPOSAL_MINUTES = 5;
const ENDING_PROPOSAL_MINUTES = 60;
const NEW_DISCUSSION_MINUTES = 5;
const COOLDOWN_HOURS = 24;

// DAO-specific Discourse category filters
const DAO_DISCOURSE_CATEGORIES: Record<string, number[]> = {
  arbitrum: [7, 8],
  // Add more DAOs and their allowed categories here as needed
};

// Initialize Resend
const resend = new Resend(RESEND_API_KEY);

// ============================================
// Main Process Entry Points
// ============================================

// Main process
async function processNotifications(): Promise<void> {
  console.log('Starting notification processing...');

  try {
    // Get enabled DAOs (those with at least one enabled governor)
    const daos = await db.public
      .selectFrom('dao')
      .selectAll()
      .where('dao.id', 'in', (qb) =>
        qb.selectFrom('daoGovernor').select('daoId').where('enabled', '=', true)
      )
      .execute();

    for (const dao of daos) {
      try {
        await processDao(dao);
      } catch (error) {
        console.error(`Error processing ${dao.name}:`, error);
      }
    }

    console.log('Notification processing completed');
  } catch (error) {
    console.error('Error during notification processing:', error);
  }
}

// Process notifications for a DAO
async function processDao(dao: Selectable<Dao>): Promise<void> {
  console.log(`\nProcessing ${dao.name}`);

  try {
    await processNewProposals(dao);
    await processEndingProposals(dao);
    await processNewDiscussions(dao);
  } catch (error) {
    console.error(`Error processing notifications for ${dao.name}:`, error);
  }
}

// ============================================
// Notification Type Processors
// ============================================

// Process new proposal notifications
async function processNewProposals(dao: Selectable<Dao>): Promise<void> {
  const daoDb = getDaoDb(dao.slug);
  if (!daoDb) {
    console.error(`Database for DAO ${dao.slug} not found`);
    return;
  }

  // Get new proposals
  const newProposals = await db.public
    .selectFrom('proposal')
    .selectAll()
    .where('daoId', '=', dao.id)
    .where('proposalState', '=', ProposalState.ACTIVE)
    .where('markedSpam', '=', false)
    .where(
      'createdAt',
      '>=',
      new Date(Date.now() - NEW_PROPOSAL_MINUTES * 60 * 1000)
    )
    .execute();

  if (newProposals.length === 0) {
    console.log(`No new proposals found for ${dao.name}`);
    return;
  }

  // Get users who want new proposal notifications
  const users = await daoDb
    .selectFrom('user')
    .select(['id', 'email'])
    .where('emailSettingsNewProposals', '=', true)
    .execute();

  console.log(
    `Found ${newProposals.length} new proposals and ${users.length} users for ${dao.name}`
  );

  for (const proposal of newProposals) {
    for (const user of users) {
      if (await alreadySent(user.id, proposal.id, 'new_proposal', dao.slug))
        continue;

      // Get author ENS if available
      const voter = proposal.author
        ? await db.public
            .selectFrom('voter')
            .select('ens')
            .where('address', '=', proposal.author)
            .executeTakeFirst()
        : null;

      const html = await render(
        NewProposalEmailTemplate({
          proposalName: proposal.name,
          proposalUrl: proposal.url,
          daoName: dao.name,
          authorAddress:
            proposal.author || '0x0000000000000000000000000000000000000000',
          authorEns: voter?.ens || undefined,
        })
      );

      const idempotencyKey = generateIdempotencyKey(
        user.id,
        proposal.id,
        'new_proposal'
      );

      await sendEmail(
        user.email,
        `New proposal in ${dao.name}`,
        html,
        idempotencyKey
      );
      await recordNotification(user.id, proposal.id, 'new_proposal', dao.slug);
    }
  }
}

// Process ending proposal notifications
async function processEndingProposals(dao: Selectable<Dao>): Promise<void> {
  const daoDb = getDaoDb(dao.slug);
  if (!daoDb) {
    console.error(`Database for DAO ${dao.slug} not found`);
    return;
  }

  // Get ending proposals
  const endingProposals = await db.public
    .selectFrom('proposal')
    .selectAll()
    .where('daoId', '=', dao.id)
    .where('proposalState', '=', ProposalState.ACTIVE)
    .where('markedSpam', '=', false)
    .where(
      'endAt',
      '<=',
      new Date(Date.now() + ENDING_PROPOSAL_MINUTES * 60 * 1000)
    )
    .where('endAt', '>', new Date())
    .execute();

  if (endingProposals.length === 0) {
    console.log(`No ending proposals found for ${dao.name}`);
    return;
  }

  // Get users who want ending proposal notifications
  const users = await daoDb
    .selectFrom('user')
    .select(['id', 'email'])
    .where('emailSettingsEndingProposals', '=', true)
    .execute();

  console.log(
    `Found ${endingProposals.length} ending proposals and ${users.length} users for ${dao.name}`
  );

  for (const proposal of endingProposals) {
    for (const user of users) {
      if (await alreadySent(user.id, proposal.id, 'ending_proposal', dao.slug))
        continue;

      const endTime = formatDistanceStrict(
        new Date(proposal.endAt),
        new Date(),
        { addSuffix: false }
      );

      const html = await render(
        EndingProposalEmailTemplate({
          proposalName: proposal.name,
          proposalUrl: proposal.url,
          daoName: dao.name,
          endTime,
        })
      );

      const idempotencyKey = generateIdempotencyKey(
        user.id,
        proposal.id,
        'ending_proposal'
      );

      await sendEmail(
        user.email,
        `Proposal ending soon in ${dao.name}`,
        html,
        idempotencyKey
      );
      await recordNotification(
        user.id,
        proposal.id,
        'ending_proposal',
        dao.slug
      );
    }
  }
}

// Process new discussion notifications
async function processNewDiscussions(dao: Selectable<Dao>): Promise<void> {
  const daoDb = getDaoDb(dao.slug);
  if (!daoDb) {
    console.error(`Database for DAO ${dao.slug} not found`);
    return;
  }

  // Check if Discourse is enabled for this DAO
  const daoDiscourse = await db.public
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', dao.id)
    .where('enabled', '=', true)
    .executeTakeFirst();

  if (!daoDiscourse) {
    console.log(`Discourse not enabled for ${dao.name}`);
    return;
  }

  // Get allowed category IDs for filtering
  const allowedCategories = DAO_DISCOURSE_CATEGORIES[dao.slug];

  let query = db.public
    .selectFrom('discourseTopic')
    .innerJoin('discoursePost', (join) =>
      join
        .onRef('discoursePost.topicId', '=', 'discourseTopic.externalId')
        .on('discoursePost.postNumber', '=', 1)
        .onRef(
          'discoursePost.daoDiscourseId',
          '=',
          'discourseTopic.daoDiscourseId'
        )
    )
    .innerJoin('discourseUser', (join) =>
      join
        .onRef('discourseUser.externalId', '=', 'discoursePost.userId')
        .onRef(
          'discourseUser.daoDiscourseId',
          '=',
          'discoursePost.daoDiscourseId'
        )
    )
    .select([
      'discourseTopic.id',
      'discourseTopic.title',
      'discourseTopic.slug',
      'discourseTopic.externalId',
      'discourseUser.username',
      'discourseUser.avatarTemplate',
    ])
    .where('discourseTopic.daoDiscourseId', '=', daoDiscourse.id)
    .where(
      'discourseTopic.createdAt',
      '>=',
      new Date(Date.now() - NEW_DISCUSSION_MINUTES * 60 * 1000)
    );

  // Apply category filter if configured
  if (allowedCategories && allowedCategories.length > 0) {
    query = query.where('discourseTopic.categoryId', 'in', allowedCategories);
  }

  const newTopics = await query.execute();

  if (newTopics.length === 0) {
    console.log(`No new discussions found for ${dao.name}`);
    return;
  }

  // Get users who want new discussion notifications
  const users = await daoDb
    .selectFrom('user')
    .select(['id', 'email'])
    .where('emailSettingsNewDiscussions', '=', true)
    .execute();

  console.log(
    `Found ${newTopics.length} new discussions and ${users.length} users for ${dao.name}`
  );

  for (const topic of newTopics) {
    const topicUrl = `${daoDiscourse.discourseBaseUrl}/t/${topic.slug}/${topic.externalId}`;

    for (const user of users) {
      if (await alreadySent(user.id, topic.id, 'new_discussion', dao.slug))
        continue;

      const html = await render(
        NewDiscussionEmailTemplate({
          discussionTitle: topic.title,
          discussionUrl: topicUrl,
          daoName: dao.name,
          authorUsername: topic.username || '',
          authorProfilePicture: topic.avatarTemplate || '',
        })
      );

      const idempotencyKey = generateIdempotencyKey(
        user.id,
        topic.id,
        'new_discussion'
      );

      await sendEmail(
        user.email,
        `New discussion in ${dao.name}`,
        html,
        idempotencyKey
      );
      await recordNotification(user.id, topic.id, 'new_discussion', dao.slug);
    }
  }
}

// ============================================
// Helper Functions
// ============================================

// Type-safe DAO database getter
function getDaoDb(daoSlug: string): Kysely<DB> | null {
  // Currently we only support arbitrum and uniswap
  if (daoSlug === 'arbitrum') {
    return db.arbitrum;
  } else if (daoSlug === 'uniswap') {
    return db.uniswap;
  }
  return null;
}

// Send email helper
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey?: string
): Promise<void> {
  try {
    await resend.emails.send(
      { from: FROM_EMAIL, to, subject, html },
      { idempotencyKey }
    );
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

// Generate idempotency key for email notifications
function generateIdempotencyKey(
  userId: string,
  targetId: string,
  type: 'new_proposal' | 'ending_proposal' | 'new_discussion'
): string {
  // Use daily buckets to ensure retries within the same day use the same key
  const date = new Date();
  const dayBucket = `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return `${userId}-${targetId}-${type}-${dayBucket}`;
}

// Check if we already sent this notification
async function alreadySent(
  userId: string,
  targetId: string,
  type: string,
  daoSlug: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

  const daoDb = getDaoDb(daoSlug);
  if (!daoDb) {
    console.error(`Database for DAO ${daoSlug} not found`);
    return false;
  }

  const existing = await daoDb
    .selectFrom('userNotification')
    .select('id')
    .where('userId', '=', userId)
    .where('targetId', '=', targetId)
    .where('type', '=', type)
    .where('sentAt', '>=', cutoff)
    .executeTakeFirst();

  return !!existing;
}

// Record notification sent
async function recordNotification(
  userId: string,
  targetId: string,
  type: string,
  daoSlug: string
): Promise<void> {
  try {
    const daoDb = getDaoDb(daoSlug);
    if (!daoDb) {
      console.error(`Database for DAO ${daoSlug} not found`);
      return;
    }

    await daoDb
      .insertInto('userNotification')
      .values({
        userId,
        targetId,
        type,
        sentAt: new Date(),
      })
      .execute();
  } catch (error) {
    console.error('Failed to record notification:', error);
  }
}

// ============================================
// Service Initialization
// ============================================

// Create health check server
const PORT = process.env.PORT || 3000;
const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      service: 'email-service',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Start HTTP server
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// Schedule cron job - runs every minute
cron.schedule('* * * * *', () => {
  console.log('\n--- Running notification check ---');
  void processNotifications();
});

// Start the service
console.log('Email service started - checking for notifications every minute');

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');

  // Close HTTP server
  server.close();

  // Close database connections
  await Promise.all([
    db.public.destroy(),
    db.arbitrum.destroy(),
    db.uniswap.destroy(),
  ]).catch(console.error);

  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
