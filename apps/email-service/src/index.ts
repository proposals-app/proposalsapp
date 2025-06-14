import { db, dbPool, type Selectable, type Dao } from '@proposalsapp/db';
import express from 'express';
import cron from 'node-cron';
import { config, validateConfig } from './config';
import { DependencyContainer } from './services/DependencyContainer';
import { CircuitBreaker } from './services/CircuitBreaker';
import { UptimeMonitor } from './services/UptimeMonitor';

// Validate configuration on startup
validateConfig();

// Initialize dependency container
const container = new DependencyContainer(
  {
    resendApiKey: config.resendApiKey,
    fromEmail: config.fromEmail,
    notificationConfig: config.notifications,
  },
  db
);

// Initialize circuit breaker if enabled
const circuitBreaker = config.circuitBreaker.enabled
  ? new CircuitBreaker(
      config.circuitBreaker.threshold,
      config.circuitBreaker.timeout
    )
  : null;

// Initialize uptime monitor if enabled
const uptimeMonitor =
  config.uptimeMonitoringEnabled && config.uptimeMonitoringUrl
    ? new UptimeMonitor(
        config.uptimeMonitoringUrl,
        config.uptimeMonitoringInterval
      )
    : null;

// Express app for health checks
const app = express();

app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.public.selectFrom('dao').select('id').limit(1).execute();

    const status = {
      status: 'healthy',
      circuitBreaker: circuitBreaker?.getState() || 'DISABLED',
      timestamp: new Date().toISOString(),
    };

    res.json(status);
  } catch (_error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Main notification processing function
async function processNotifications(): Promise<void> {
  console.log('Starting notification processing...');

  try {
    // Get all enabled DAOs
    const daos = await container.getDaoRepository().getEnabledDaos();
    console.log(`Found ${daos.length} enabled DAOs`);

    for (const dao of daos) {
      await processDao(dao);
    }

    console.log('Notification processing completed successfully');
  } catch (error) {
    console.error('Error during notification processing:', error);
    throw error;
  }
}

// Process notifications for a single DAO
async function processDao(dao: Selectable<Dao>): Promise<void> {
  console.log(`\nProcessing notifications for ${dao.name}`);

  try {
    // Get notification service for this DAO
    const notificationService = container.getNotificationService(dao.slug);

    // Process new proposals
    await notificationService.processNewProposalNotifications(dao);

    // Process ending proposals
    await notificationService.processEndingProposalNotifications(dao);

    // Process new discussions if Discourse is enabled
    const daoDiscourse = await db.public
      .selectFrom('daoDiscourse')
      .selectAll()
      .where('daoId', '=', dao.id)
      .where('enabled', '=', true)
      .executeTakeFirst();

    if (daoDiscourse) {
      await notificationService.processNewDiscussionNotifications(
        dao,
        daoDiscourse.id
      );
    }
  } catch (error) {
    console.error(`Error processing notifications for ${dao.name}:`, error);
    // Continue with other DAOs even if one fails
  }
}

// Schedule cron job
const task = cron.schedule(config.cronSchedule, async () => {
  console.log('\n--- Cron job triggered ---');

  const executeWithCircuitBreaker = circuitBreaker
    ? () => circuitBreaker.execute(() => processNotifications())
    : processNotifications;

  try {
    await executeWithCircuitBreaker();
  } catch (error) {
    if (error instanceof Error && error.message === 'Circuit breaker is OPEN') {
      console.error(
        'Circuit breaker is OPEN, skipping notification processing'
      );
    } else {
      console.error('Error in cron job:', error);
    }
  }
});

// Start services
app.listen(config.port, () => {
  console.log(`Email service is running on port ${config.port}`);
  console.log(
    `Health check available at http://localhost:${config.port}/health`
  );

  task.start();
  console.log('Cron job scheduled to run:', config.cronSchedule);

  if (uptimeMonitor) {
    uptimeMonitor.start();
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');

  task.stop();

  if (uptimeMonitor) {
    uptimeMonitor.stop();
  }

  // Close database pools
  dbPool.public.end();
  dbPool.arbitrum.end();
  dbPool.uniswap.end();

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
