import { db, type Selectable, type Dao } from '@proposalsapp/db';
import { Resend } from 'resend';
import cron from 'node-cron';
import { formatDistanceStrict } from 'date-fns';
import { config as dotenv_config } from 'dotenv';
import { render, toPlainText } from 'react-email';
import {
  NewProposalEmailTemplate,
  NewDiscussionEmailTemplate,
  EndingProposalEmailTemplate,
} from '@proposalsapp/emails';
import {
  deliverNotificationToRecipients,
  type NotificationRecipient,
  type NotificationType,
} from './notification-delivery';
import { createServer } from 'http';
import pino from 'pino';
import {
  DAO_DISCOURSE_CATEGORY_FILTERS,
  ENABLED_DAO_SLUGS,
} from '@proposalsapp/governance';
import {
  createSendThrottle,
  parseMaxSendsPerSecond,
  requireResendDelivery,
} from './resend-delivery';
import {
  findEndingProposals,
  findNewDiscussionTopics,
  findNewProposals,
  hasAlreadySent,
  NEW_ITEM_LOOKBACK_HOURS,
  recordNotificationSent,
} from './notification-selection';

dotenv_config();

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    bindings: (bindings) => {
      return {
        ...bindings,
      };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
});

// Configuration - only what we actually need
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  logger.error('Missing required environment variable: RESEND_API_KEY');
  process.exit(1);
}

// BetterStack monitoring configuration
const BETTERSTACK_KEY = process.env.BETTERSTACK_KEY;

const FROM_EMAIL =
  process.env.FROM_EMAIL || 'Proposals.app <no-reply@proposals.app>';

// Initialize Resend
const resend = new Resend(RESEND_API_KEY);
const RESEND_MAX_SENDS_PER_SECOND = parseMaxSendsPerSecond(
  process.env.RESEND_MAX_SENDS_PER_SECOND
);
const waitForSendSlot = createSendThrottle(RESEND_MAX_SENDS_PER_SECOND);

// ============================================
// Main Process Entry Points
// ============================================

// Main process
async function processNotifications(): Promise<void> {
  logger.info('Starting notification processing...');

  const daos = await db
    .selectFrom('dao')
    .selectAll()
    .where('dao.slug', 'in', [...ENABLED_DAO_SLUGS])
    .execute();
  await settleAll(
    daos.map(async (dao) => {
      try {
        await processDao(dao);
      } catch (error) {
        logger.error(
          { err: error, dao: dao.slug },
          'DAO notification processing failed'
        );
        throw error;
      }
    }),
    'Notification processing failed'
  );

  logger.info('Notification processing completed');
}

// Process notifications for a DAO
async function processDao(dao: Selectable<Dao>): Promise<void> {
  logger.info(`Processing ${dao.name}`);

  await settleAll(
    [
      processNewProposals(dao),
      processEndingProposals(dao),
      processNewDiscussions(dao),
    ],
    `Notification processing failed for ${dao.slug}`
  );
}

// ============================================
// Notification Type Processors
// ============================================

// Process new proposal notifications
async function processNewProposals(dao: Selectable<Dao>): Promise<void> {
  // Active proposals whose voting opened within the lookback window; ones
  // already emailed are skipped per recipient by `alreadySent`.
  const newProposals = await findNewProposals(dao.id);

  if (newProposals.length === 0) {
    logger.debug(`No new proposals found for ${dao.name}`);
    return;
  }

  // Get users who want new proposal notifications
  const users = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('emailSettingsNewProposals', '=', true)
    .execute();

  logger.info(
    `Found ${newProposals.length} new proposals and ${users.length} users for ${dao.name}`
  );

  await settleAll(
    newProposals.map(async (proposal) => {
      const voter = proposal.author
        ? await db
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
          daoSlug: dao.slug,
          authorAddress:
            proposal.author || '0x0000000000000000000000000000000000000000',
          authorEns: voter?.ens || undefined,
        })
      );

      await notifyRecipients({
        users,
        targetId: proposal.id,
        type: 'new_proposal',
        daoId: dao.id,
        subject: `New proposal in ${dao.name}`,
        html,
      });
    }),
    `New proposal notifications failed for ${dao.slug}`
  );
}

// Process ending proposal notifications
async function processEndingProposals(dao: Selectable<Dao>): Promise<void> {
  const endingProposals = await findEndingProposals(dao.id);

  if (endingProposals.length === 0) {
    logger.debug(`No ending proposals found for ${dao.name}`);
    return;
  }

  // Get users who want ending proposal notifications
  const users = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('emailSettingsEndingProposals', '=', true)
    .execute();

  logger.info(
    `Found ${endingProposals.length} ending proposals and ${users.length} users for ${dao.name}`
  );

  await settleAll(
    endingProposals.map(async (proposal) => {
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
          daoSlug: dao.slug,
          endTime,
        })
      );

      await notifyRecipients({
        users,
        targetId: proposal.id,
        type: 'ending_proposal',
        daoId: dao.id,
        subject: `Proposal ending soon in ${dao.name}`,
        html,
      });
    }),
    `Ending proposal notifications failed for ${dao.slug}`
  );
}

// Process new discussion notifications
async function processNewDiscussions(dao: Selectable<Dao>): Promise<void> {
  // Check if Discourse is enabled for this DAO
  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', dao.id)
    .executeTakeFirst();

  if (!daoDiscourse) {
    logger.debug(`Discourse not enabled for ${dao.name}`);
    return;
  }

  // Topics created within the lookback window; ones already emailed are
  // skipped per recipient by `alreadySent`.
  const newTopics = await findNewDiscussionTopics({
    daoDiscourseId: daoDiscourse.id,
    allowedCategories: DAO_DISCOURSE_CATEGORY_FILTERS[dao.slug],
  });

  if (newTopics.length === 0) {
    logger.debug(`No new discussions found for ${dao.name}`);
    return;
  }

  // Get users who want new discussion notifications
  const users = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('emailSettingsNewDiscussions', '=', true)
    .execute();

  logger.info(
    `Found ${newTopics.length} new discussions and ${users.length} users for ${dao.name}`
  );

  await settleAll(
    newTopics.map(async (topic) => {
      const topicUrl = `${daoDiscourse.discourseBaseUrl}/t/${topic.slug}/${topic.externalId}`;
      const html = await render(
        NewDiscussionEmailTemplate({
          discussionTitle: topic.title,
          discussionUrl: topicUrl,
          daoName: dao.name,
          daoSlug: dao.slug,
          authorUsername: topic.username || '',
          authorProfilePicture: topic.avatarTemplate || '',
        })
      );

      await notifyRecipients({
        users,
        targetId: topic.id,
        type: 'new_discussion',
        daoId: dao.id,
        subject: `New discussion in ${dao.name}`,
        html,
      });
    }),
    `New discussion notifications failed for ${dao.slug}`
  );
}

// ============================================
// Helper Functions
// ============================================

async function notifyRecipients(input: {
  users: NotificationRecipient[];
  targetId: string;
  type: NotificationType;
  daoId: string;
  subject: string;
  html: string;
}): Promise<void> {
  await deliverNotificationToRecipients(
    { sendEmail, recordNotification, alreadySent },
    {
      recipients: input.users,
      targetId: input.targetId,
      type: input.type,
      daoId: input.daoId,
      subject: input.subject,
      html: input.html,
    }
  );
}

async function settleAll(
  work: Promise<void>[],
  message: string
): Promise<void> {
  const results = await Promise.allSettled(work);
  const failures = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : []
  );

  if (failures.length > 0) {
    throw new AggregateError(failures, message);
  }
}

// Send email helper
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey?: string
): Promise<void> {
  try {
    await waitForSendSlot();
    const result = await resend.emails.send(
      { from: FROM_EMAIL, to, subject, html, text: toPlainText(html) },
      { idempotencyKey }
    );
    const deliveryId = requireResendDelivery(result);
    logger.info({ deliveryId, subject }, 'Email sent');
  } catch (error) {
    logger.error({ err: error }, 'Failed to send email');
    throw error;
  }
}

// Check if we already sent this notification. New-proposal and new-discussion
// emails count any previous send; ending-proposal reminders use a cooldown.
async function alreadySent(
  userId: string,
  targetId: string,
  type: NotificationType,
  daoId: string
): Promise<boolean> {
  return hasAlreadySent({ userId, targetId, type, daoId });
}

// Record notification sent
async function recordNotification(
  userId: string,
  targetId: string,
  type: NotificationType,
  daoId: string
): Promise<void> {
  try {
    await recordNotificationSent({ userId, targetId, type, daoId });
  } catch (error) {
    logger.error({ err: error }, 'Failed to record notification');
    throw error;
  }
}

// ============================================
// Service Initialization
// ============================================

// Create health check server
const PORT = process.env.PORT || 3000;
const processingState: {
  lastRunAt: string | null;
  lastError: string | null;
} = {
  lastRunAt: null,
  lastError: null,
};
const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const isStarting = processingState.lastRunAt === null;
    const status = isStarting
      ? 'starting'
      : processingState.lastError
        ? 'degraded'
        : 'healthy';
    res.writeHead(isStarting || processingState.lastError ? 503 : 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        status,
        service: 'email-service',
        timestamp: new Date().toISOString(),
        lastRunAt: processingState.lastRunAt,
        lastError: processingState.lastError,
      })
    );
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Start HTTP server
server.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
});

// Start BetterStack heartbeat monitoring
let heartbeatInterval: NodeJS.Timeout | undefined;
if (BETTERSTACK_KEY) {
  logger.info('BetterStack uptime monitoring enabled');

  // Send heartbeat every 10 seconds
  heartbeatInterval = setInterval(async () => {
    try {
      const response = await fetch(BETTERSTACK_KEY, { method: 'GET' });
      if (response.ok) {
        logger.debug('Uptime ping sent successfully');
      } else {
        logger.warn(
          `Failed to send uptime ping: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to send uptime ping');
    }
  }, 10000); // 10 seconds
} else {
  logger.info('BETTERSTACK_KEY not set, uptime monitoring disabled');
}

let isProcessingNotifications = false;

async function runNotificationCycle(): Promise<void> {
  if (isProcessingNotifications) {
    logger.warn('Skipping notification check; previous run still in progress');
    return;
  }

  isProcessingNotifications = true;
  logger.info('Running notification check');

  try {
    await processNotifications();
    processingState.lastError = null;
  } catch (error) {
    logger.error({ err: error }, 'Notification check failed');
    processingState.lastError = 'Notification processing failed';
  } finally {
    processingState.lastRunAt = new Date().toISOString();
    isProcessingNotifications = false;
  }
}

// Schedule cron job - runs every minute
cron.schedule('* * * * *', () => {
  void runNotificationCycle();
});

// Start the service
logger.info(
  {
    newItemLookbackHours: NEW_ITEM_LOOKBACK_HOURS,
    resendMaxSendsPerSecond: RESEND_MAX_SENDS_PER_SECOND,
  },
  'Email service started - checking for notifications every minute'
);
void runNotificationCycle();

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');

  // Clear heartbeat interval if it exists
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Close HTTP server
  server.close();

  // Close database connection
  await db
    .destroy()
    .catch((err) => logger.error({ err }, 'Error closing database connection'));

  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ promise, reason }, 'Unhandled rejection');
  process.exit(1);
});
