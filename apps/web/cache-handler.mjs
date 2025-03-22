import { CacheHandler } from '@neshca/cache-handler';
import { createClient } from 'redis';
import createLruHandler from '@neshca/cache-handler/local-lru';
import createRedisHandler from '@neshca/cache-handler/redis-stack';

CacheHandler.onCreation(async () => {
  const redisClient = await initRedisClient();
  return {
    handlers: [createCacheHandler(redisClient)],
  };
});

/**
 * Initializes and connects to Redis with proper error handling
 * @returns {Promise<import('redis').RedisClientType|null>}
 */
async function initRedisClient() {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not configured, skipping Redis initialization');
    return null;
  }

  let client;
  try {
    client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000, // 5 second connection timeout
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000), // Exponential backoff with cap
      },
    });

    // Set up persistent error handling
    client.on('error', (err) => {
      console.warn('Redis error:', err.message);
    });

    // Optional: Log reconnection attempts
    client.on('reconnecting', () => {
      console.info('Attempting to reconnect to Redis...');
    });

    console.info('Connecting to Redis...');
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
      ),
    ]);

    console.info('Redis client connected successfully');
    return client;
  } catch (error) {
    console.error('Redis connection failed:', error.message);

    if (client) {
      try {
        await client.disconnect();
        console.info(
          'Redis client disconnected after failed connection attempt'
        );
      } catch (disconnectError) {
        console.warn(
          'Failed to disconnect Redis client:',
          disconnectError.message
        );
      }
    }

    return null;
  }
}

/**
 * Creates the appropriate cache handler based on Redis availability
 * @param {import('redis').RedisClientType|null} redisClient
 * @returns {import('@neshca/cache-handler').Handler}
 */
function createCacheHandler(redisClient) {
  if (redisClient?.isReady) {
    console.info('Using Redis cache handler');
    return createRedisHandler({
      client: redisClient,
      keyPrefix: `cache:${process.env.NODE_ENV || 'development'}:`,
      timeoutMs: 1000,
      // Optional: Add fallback behavior if Redis operations fail
      fallbackHandler: createLruHandler({ maxItems: 1000 }),
    });
  } else {
    console.info('Using local LRU cache handler (Redis unavailable)');
    return createLruHandler({
      maxItems: 5000,
      maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    });
  }
}

export default CacheHandler;
