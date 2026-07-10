import { createServer } from 'node:http';
import { config as dotenvConfig } from 'dotenv';
import { dbPool } from '@proposalsapp/db';
import { loadConfig } from './config';
import { runDelegateMappingWorker } from './delegates/worker';
import { closeMappingAgentResources } from './lifecycle';
import { createLogger } from './logger';
import { runProposalMappingWorker } from './proposals/worker';
import {
  createTaskHealthState,
  evaluateServiceHealth,
  recordTaskFailure,
  recordTaskSuccess,
  type TaskHealthState,
} from './health';

dotenvConfig();

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      resolve();
    };

    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function runPeriodicTask(params: {
  name: 'proposalWorker' | 'delegateWorker' | 'uptime';
  intervalMs: number;
  signal: AbortSignal;
  logger: ReturnType<typeof createLogger>;
  state: TaskHealthState;
  task: () => Promise<void>;
}): Promise<void> {
  while (!params.signal.aborted) {
    try {
      await params.task();
      recordTaskSuccess(params.state, new Date());
    } catch (error) {
      recordTaskFailure(params.state, new Date(), error);
      params.logger.error(
        {
          task: params.name,
          err: error,
        },
        'Periodic mapping task failed'
      );
    }

    await sleep(params.intervalMs, params.signal);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const abortController = new AbortController();
  const proposalState = createTaskHealthState();
  const delegateState = createTaskHealthState();
  const uptimeState = createTaskHealthState();

  const server = createServer((request, response) => {
    if (request.url === '/health' && request.method === 'GET') {
      const status = evaluateServiceHealth([proposalState, delegateState]);
      response.writeHead(status === 'healthy' ? 200 : 503, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      response.end(
        JSON.stringify({
          status,
          proposalWorker: proposalState,
          delegateWorker: delegateState,
          uptime: uptimeState,
        })
      );
      return;
    }

    response.writeHead(404);
    response.end('Not found');
  });

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Mapping agent health server listening');
  });

  logger.info(
    {
      dryRun: config.dryRun,
      runOnce: config.runOnce,
      daos: config.enabledDaoSlugs,
    },
    'Mapping agent configuration loaded'
  );

  dbPool.on('error', (error) => {
    logger.warn(
      {
        err: error,
      },
      'Postgres pool emitted an idle client error'
    );
  });

  if (config.runOnce) {
    try {
      await runProposalMappingWorker(config, logger);
      await runDelegateMappingWorker(config, logger);
    } finally {
      await closeMappingAgentResources(server);
    }
    return;
  }

  const proposalLoop = runPeriodicTask({
    name: 'proposalWorker',
    intervalMs: config.proposalIntervalMs,
    signal: abortController.signal,
    logger,
    state: proposalState,
    task: async () => {
      await runProposalMappingWorker(config, logger);
    },
  });

  const delegateLoop = runPeriodicTask({
    name: 'delegateWorker',
    intervalMs: config.delegateIntervalMs,
    signal: abortController.signal,
    logger,
    state: delegateState,
    task: async () => {
      await runDelegateMappingWorker(config, logger);
    },
  });

  const uptimeLoop = config.betterstackUrl
    ? runPeriodicTask({
        name: 'uptime',
        intervalMs: 10_000,
        signal: abortController.signal,
        logger,
        state: uptimeState,
        task: async () => {
          const response = await fetch(config.betterstackUrl!, {
            method: 'GET',
          });

          if (!response.ok) {
            throw new Error(`Better Stack ping failed with ${response.status}`);
          }
        },
      })
    : Promise.resolve();

  const shutdown = () => {
    abortController.abort();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await Promise.all([proposalLoop, delegateLoop, uptimeLoop]);
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await closeMappingAgentResources(server);
  }
}

void main();
