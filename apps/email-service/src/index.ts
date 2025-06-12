import { db, dbPool } from '@proposalsapp/db';
import {
  EndingProposalEmailTemplate,
  NewDiscussionEmailTemplate,
  NewProposalEmailTemplate,
  resend,
} from '@proposalsapp/emails';
import axios from 'axios';
import { config } from 'dotenv';
import express from 'express';
import cron from 'node-cron';

config();

export type ProposalItem = {
  type: 'proposal';
  name: string;
  externalId: string;
  governorId: string;
};

export type TopicItem = {
  type: 'topic';
  name: string;
  externalId: string;
  daoDiscourseId: string;
};

export type ProposalGroupItem = ProposalItem | TopicItem;

// Circuit breaker state
let circuitBreakerOpen = false;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

// Helper function to check database health
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.public.selectFrom('dao').select('id').limit(1).execute();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Helper function to handle circuit breaker
async function withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T | null> {
  if (circuitBreakerOpen) {
    console.log('Circuit breaker is open, skipping database operations');
    return null;
  }

  try {
    const result = await fn();
    consecutiveFailures = 0; // Reset on success
    return result;
  } catch (error) {
    consecutiveFailures++;
    console.error(
      `Operation failed. Consecutive failures: ${consecutiveFailures}`,
      error
    );

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      circuitBreakerOpen = true;
      console.error(
        'Circuit breaker opened due to consecutive failures. Will retry in 1 minute.'
      );

      // Reset circuit breaker after timeout
      setTimeout(() => {
        circuitBreakerOpen = false;
        consecutiveFailures = 0;
        console.log('Circuit breaker reset, resuming operations');
      }, CIRCUIT_BREAKER_TIMEOUT);
    }

    throw error;
  }
}

// Helper function to generate idempotency key
function generateIdempotencyKey(
  userId: string,
  notificationType: string,
  targetId: string
): string {
  return `${userId}-${notificationType}-${targetId}`;
}

export async function checkNewProposals() {
  await withCircuitBreaker(async () => {
    try {
      // Check for new proposals
      const newProposals = await db.public
        .selectFrom('proposal')
        .selectAll()
        .where('createdAt', '>', new Date(Date.now() - 3 * 60 * 60 * 1000))
        .execute();

      for (const proposal of newProposals) {
        // Check if proposal is part of a group
        const proposalGroups = await db.public
          .selectFrom('proposalGroup')
          .selectAll()
          .where('daoId', '=', proposal.daoId)
          .where('name', '!=', 'UNGROUPED')
          .execute();

        let groupId: string | undefined;
        for (const group of proposalGroups) {
          const items = Array.isArray(group.items)
            ? (group.items as ProposalGroupItem[])
            : [];
          const isInGroup =
            items.length > 0 &&
            items.some(
              (item) =>
                item.type === 'proposal' &&
                item.externalId === proposal.externalId &&
                item.governorId === proposal.governorId
            );
          if (isInGroup) {
            groupId = group.id;
            break;
          }
        }

        // If not in a group yet, wait for the next iteration
        if (!groupId) {
          console.log(
            `Proposal ${proposal.id} is not part of a group yet, waiting for next iteration`
          );
          continue;
        }

        // Get the author information from the voter table
        const author = await db.public
          .selectFrom('voter')
          .selectAll()
          .where('address', '=', proposal.author)
          .executeTakeFirst();

        // Get the DAO name and slug
        const dao = await db.public
          .selectFrom('dao')
          .selectAll()
          .where('id', '=', proposal.daoId)
          .executeTakeFirst();

        if (!dao) {
          console.error(`DAO not found for proposal ${proposal.id}`);
          continue;
        }

        if (!(dao.slug in db)) {
          throw new Error(
            `Database schema for DAO slug '${dao.slug}' is not configured or found.`
          );
        }

        // Get users who have enabled new proposal notifications from the specific web schema
        const users = await db[dao.slug as keyof typeof db]
          .selectFrom('user')
          .select(['id', 'email'])
          .where('emailSettingsNewProposals', '=', true)
          .execute();

        for (const user of users) {
          if (!user.email) continue;

          const idempotencyKey = generateIdempotencyKey(
            user.id,
            'EMAIL_NEW_PROPOSAL',
            proposal.id
          );

          // Check if notification already sent in the specific DAO schema
          const existingNotification = await db[dao.slug as keyof typeof db]
            .selectFrom('userNotification')
            .selectAll()
            .where((eb) =>
              eb.and([
                eb('userId', '=', user.id),
                eb('type', '=', 'EMAIL_NEW_PROPOSAL'),
                eb('targetId', '=', proposal.id),
              ])
            )
            .executeTakeFirst();

          if (existingNotification) continue;

          try {
            // Start a transaction to ensure atomicity
            await db[dao.slug as keyof typeof db]
              .transaction()
              .execute(async (trx) => {
                // Double-check within transaction
                const existingInTx = await trx
                  .selectFrom('userNotification')
                  .selectAll()
                  .where((eb) =>
                    eb.and([
                      eb('userId', '=', user.id),
                      eb('type', '=', 'EMAIL_NEW_PROPOSAL'),
                      eb('targetId', '=', proposal.id),
                    ])
                  )
                  .executeTakeFirst();

                if (existingInTx) return;

                // Record notification first to prevent duplicates
                await trx
                  .insertInto('userNotification')
                  .values({
                    userId: user.id,
                    type: 'EMAIL_NEW_PROPOSAL',
                    targetId: proposal.id,
                    sentAt: new Date(),
                  })
                  .execute();

                // Send email with idempotency key
                const { error } = await resend.emails.send(
                  {
                    from: 'Proposals.app <notifications@proposals.app>',
                    to: [user.email],
                    subject: `New proposal in ${dao.name}`,
                    react: NewProposalEmailTemplate({
                      proposalName: proposal.name,
                      proposalUrl: `https://${dao.slug}.proposals.app/${groupId}`,
                      daoName: dao.name,
                      authorAddress: author?.address ?? '',
                      authorEns: author?.ens ?? '',
                    }),
                  },
                  { idempotencyKey }
                );

                if (error) {
                  // If email fails, rollback the transaction
                  throw new Error(`Email send failed: ${error}`);
                }
              });
          } catch (error) {
            console.error(
              `Failed to send new proposal email to ${user.email}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error('Error checking new proposals:', error);
      throw error; // Re-throw to trigger circuit breaker
    }
  });
}

export async function checkNewDiscussions() {
  await withCircuitBreaker(async () => {
    try {
      // Get discussions created in the last minute
      const newDiscussions = await db.public
        .selectFrom('discourseTopic')
        .selectAll()
        .where('createdAt', '>=', new Date(Date.now() - 3 * 60 * 60 * 1000))
        .execute();

      for (const discussion of newDiscussions) {
        // Check if discussion is part of a group
        const daoDiscourse = await db.public
          .selectFrom('daoDiscourse')
          .selectAll()
          .where('id', '=', discussion.daoDiscourseId)
          .executeTakeFirst();

        if (!daoDiscourse) {
          console.error(
            `DAO discourse not found for discussion ${discussion.id}`
          );
          continue;
        }

        // Get the first post of the discussion to get the author
        const firstPost = await db.public
          .selectFrom('discoursePost')
          .selectAll()
          .where((eb) =>
            eb.and([
              eb('topicId', '=', discussion.externalId),
              eb('daoDiscourseId', '=', discussion.daoDiscourseId),
              eb('postNumber', '=', 1),
            ])
          )
          .executeTakeFirst();

        if (!firstPost) {
          console.error(`First post not found for discussion ${discussion.id}`);
          continue;
        }

        // Get the author information from Discourse
        const discourseUser = await db.public
          .selectFrom('discourseUser')
          .selectAll()
          .where((eb) =>
            eb.and([
              eb('externalId', '=', firstPost.userId),
              eb('daoDiscourseId', '=', discussion.daoDiscourseId),
            ])
          )
          .executeTakeFirst();

        if (!discourseUser) {
          console.error(
            `Discourse user not found for discussion ${discussion.id}`
          );
          continue;
        }

        const proposalGroups = await db.public
          .selectFrom('proposalGroup')
          .selectAll()
          .where('daoId', '=', daoDiscourse.daoId)
          .where('name', '!=', 'UNGROUPED')
          .execute();

        let groupId: string | undefined;
        for (const group of proposalGroups) {
          const items = Array.isArray(group.items)
            ? (group.items as ProposalGroupItem[])
            : [];
          const isInGroup =
            items.length > 0 &&
            items.some(
              (item) =>
                item.type === 'topic' &&
                item.externalId === discussion.externalId.toString() &&
                item.daoDiscourseId === discussion.daoDiscourseId
            );
          if (isInGroup) {
            groupId = group.id;
            break;
          }
        }

        // If not in a group yet, wait for the next iteration
        if (!groupId) {
          console.log(
            `Discussion ${discussion.id} is not part of a group yet, waiting for next iteration`
          );
          continue;
        }

        // Get the DAO name and slug
        const dao = await db.public
          .selectFrom('dao')
          .selectAll()
          .where('id', '=', daoDiscourse.daoId)
          .executeTakeFirst();

        if (!dao) {
          console.error(`DAO not found for discussion ${discussion.id}`);
          continue;
        }

        if (!(dao.slug in db)) {
          throw new Error(
            `Database schema for DAO slug '${dao.slug}' is not configured or found.`
          );
        }

        // Get users who have enabled new discussion notifications from the specific web schema
        const users = await db[dao.slug as keyof typeof db]
          .selectFrom('user')
          .select(['id', 'email'])
          .where('emailSettingsNewDiscussions', '=', true)
          .execute();

        for (const user of users) {
          if (!user.email) continue;

          const idempotencyKey = generateIdempotencyKey(
            user.id,
            'EMAIL_NEW_DISCUSSION',
            discussion.id
          );

          // Check if notification was already sent in the specific DAO schema
          const existingNotification = await db[dao.slug as keyof typeof db]
            .selectFrom('userNotification')
            .selectAll()
            .where((eb) =>
              eb.and([
                eb('userId', '=', user.id),
                eb('type', '=', 'EMAIL_NEW_DISCUSSION'),
                eb('targetId', '=', discussion.id),
              ])
            )
            .executeTakeFirst();

          if (existingNotification) {
            continue;
          }

          try {
            // Start a transaction to ensure atomicity
            await db[dao.slug as keyof typeof db]
              .transaction()
              .execute(async (trx) => {
                // Double-check within transaction
                const existingInTx = await trx
                  .selectFrom('userNotification')
                  .selectAll()
                  .where((eb) =>
                    eb.and([
                      eb('userId', '=', user.id),
                      eb('type', '=', 'EMAIL_NEW_DISCUSSION'),
                      eb('targetId', '=', discussion.id),
                    ])
                  )
                  .executeTakeFirst();

                if (existingInTx) return;

                // Record notification first to prevent duplicates
                await trx
                  .insertInto('userNotification')
                  .values({
                    userId: user.id,
                    type: 'EMAIL_NEW_DISCUSSION',
                    targetId: discussion.id,
                    sentAt: new Date(),
                  })
                  .execute();

                // Send email with idempotency key
                const { error } = await resend.emails.send(
                  {
                    from: 'Proposals.app <notifications@proposals.app>',
                    to: [user.email],
                    subject: `New Discussion in ${dao.name}`,
                    react: NewDiscussionEmailTemplate({
                      discussionTitle: discussion.title || 'New Discussion',
                      discussionUrl: `https://${dao.slug}.proposals.app/${groupId}`,
                      daoName: dao.name,
                      authorUsername: discourseUser.username,
                      authorProfilePicture: discourseUser.avatarTemplate,
                    }),
                  },
                  { idempotencyKey }
                );

                if (error) {
                  // If email fails, rollback the transaction
                  throw new Error(`Email send failed: ${error}`);
                }
              });
          } catch (error) {
            console.error(
              `Failed to send new discussion email to ${user.email}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in checkNewDiscussions:', error);
      throw error; // Re-throw to trigger circuit breaker
    }
  });
}

export async function checkEndingProposals() {
  await withCircuitBreaker(async () => {
    try {
      // Check for ending proposals
      const endingProposals = await db.public
        .selectFrom('proposal')
        .selectAll()
        .where((eb) =>
          eb.and([
            eb('endAt', '>', new Date(Date.now() + 21 * 60 * 60 * 1000)),
            eb('endAt', '<', new Date(Date.now() + 28 * 60 * 60 * 1000)),
          ])
        )
        .execute();

      for (const proposal of endingProposals) {
        // Check if proposal is part of a group
        const proposalGroups = await db.public
          .selectFrom('proposalGroup')
          .selectAll()
          .where('daoId', '=', proposal.daoId)
          .where('name', '!=', 'UNGROUPED')
          .execute();

        let groupId: string | undefined;
        for (const group of proposalGroups) {
          const items = Array.isArray(group.items)
            ? (group.items as ProposalGroupItem[])
            : [];
          const isInGroup =
            items.length > 0 &&
            items.some(
              (item) =>
                item.type === 'proposal' &&
                item.externalId === proposal.externalId &&
                item.governorId === proposal.governorId
            );
          if (isInGroup) {
            groupId = group.id;
            break;
          }
        }

        // If not in a group yet, wait for the next iteration
        if (!groupId) {
          console.log(
            `Proposal ${proposal.id} is not part of a group yet, waiting for next iteration`
          );
          continue;
        }

        // Get the DAO name and slug
        const dao = await db.public
          .selectFrom('dao')
          .selectAll()
          .where('id', '=', proposal.daoId)
          .executeTakeFirst();

        if (!dao) {
          console.error(`DAO not found for proposal ${proposal.id}`);
          continue;
        }

        if (!(dao.slug in db)) {
          throw new Error(
            `Database schema for DAO slug '${dao.slug}' is not configured or found.`
          );
        }

        // Get users who have enabled ending proposal notifications from the specific web schema
        const users = await db[dao.slug as keyof typeof db]
          .selectFrom('user') // Use unprefixed table name
          .select(['id', 'email'])
          .where('emailSettingsEndingProposals', '=', true)
          .execute();

        for (const user of users) {
          if (!user.email) continue;

          const idempotencyKey = generateIdempotencyKey(
            user.id,
            'EMAIL_ENDING_PROPOSAL',
            proposal.id
          );

          // Check if notification already sent in the specific DAO schema
          const existingNotification = await db[dao.slug as keyof typeof db]
            .selectFrom('userNotification') // Use unprefixed table name
            .selectAll()
            .where((eb) =>
              eb.and([
                eb('userId', '=', user.id),
                eb('type', '=', 'EMAIL_ENDING_PROPOSAL'),
                eb('targetId', '=', proposal.id),
              ])
            )
            .executeTakeFirst();

          if (existingNotification) continue;

          try {
            // Start a transaction to ensure atomicity
            await db[dao.slug as keyof typeof db]
              .transaction()
              .execute(async (trx) => {
                // Double-check within transaction
                const existingInTx = await trx
                  .selectFrom('userNotification')
                  .selectAll()
                  .where((eb) =>
                    eb.and([
                      eb('userId', '=', user.id),
                      eb('type', '=', 'EMAIL_ENDING_PROPOSAL'),
                      eb('targetId', '=', proposal.id),
                    ])
                  )
                  .executeTakeFirst();

                if (existingInTx) return;

                // Record notification first to prevent duplicates
                await trx
                  .insertInto('userNotification')
                  .values({
                    userId: user.id,
                    type: 'EMAIL_ENDING_PROPOSAL',
                    targetId: proposal.id,
                    sentAt: new Date(),
                  })
                  .execute();

                // Send email with idempotency key
                const { error } = await resend.emails.send(
                  {
                    from: 'Proposals.app <notifications@proposals.app>',
                    to: [user.email],
                    subject: `Proposal ending soon in ${dao.name}`,
                    react: EndingProposalEmailTemplate({
                      proposalName: proposal.name,
                      proposalUrl: `https://${dao.slug}.proposals.app/${groupId}`,
                      daoName: dao.name,
                      endTime: proposal.endAt.toISOString(),
                    }),
                  },
                  { idempotencyKey }
                );

                if (error) {
                  // If email fails, rollback the transaction
                  throw new Error(`Email send failed: ${error}`);
                }
              });
          } catch (error) {
            console.error(
              `Failed to send ending proposal email to ${user.email}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error('Error checking ending proposals:', error);
      throw error; // Re-throw to trigger circuit breaker
    }
  });
}

// Define the scheduled job function
async function runScheduledJobs() {
  // Skip if circuit breaker is open
  if (circuitBreakerOpen) {
    console.log('Circuit breaker is open, skipping scheduled jobs');
    return;
  }

  try {
    // Check database health before running jobs
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      console.error('Database is not healthy, skipping scheduled jobs');
      return;
    }

    await checkNewProposals();
    await checkNewDiscussions();
    await checkEndingProposals();
  } catch (error) {
    console.error('Error running scheduled jobs:', error);
  }
}

// Schedule jobs to run every minute
cron.schedule('* * * * *', runScheduledJobs);

// Run jobs immediately on start
runScheduledJobs();

// Send uptime ping every 10 seconds
const sendUptimePing = async () => {
  try {
    console.log('Sending uptime ping...');
    await axios.get(`${process.env.BETTERSTACK_KEY}`);
  } catch (error) {
    console.error('Error sending uptime ping:', error);
  }
};

setInterval(sendUptimePing, 10 * 1000);

const app = express();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const isHealthy = await checkDatabaseHealth();
    const status = {
      healthy: isHealthy && !circuitBreakerOpen,
      circuitBreakerOpen,
      consecutiveFailures,
    };

    res.status(isHealthy && !circuitBreakerOpen ? 200 : 503).json(status);
  } catch (_error) {
    res.status(503).json({ healthy: false, error: 'Health check failed' });
  }
});

// Start server
app.listen(3000, () => {
  console.log(`Email service listening on port 3000`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Close database pools
  await dbPool.public.end();
  await dbPool.arbitrum.end();
  await dbPool.uniswap.end();

  process.exit(0);
});

export { app };
