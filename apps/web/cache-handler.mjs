// @ts-check
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configure Redis client with keepalive settings
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
/** @type {any} */
let redis = null;
let isConnecting = false;
/** @type {Promise<any> | null} */
let connectionPromise = null;

// Create Redis client lazily
function createRedisClient() {
  return createClient({
    url: redisUrl,
    // Keep connection alive with periodic pings
    pingInterval: 30000, // 30 seconds
    socket: {
      keepAlive: true, // Enable TCP keep-alive
      connectTimeout: 10000, // 10 seconds
      reconnectStrategy: (times) => {
        // Exponential backoff with max delay of 30 seconds
        const delay = Math.min(times * 50, 30000);
        console.log(`Redis reconnecting attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
    },
  });
}

// Connect to Redis lazily
async function ensureRedisConnection() {
  // If we're in build phase, skip Redis connection
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return null;
  }

  if (redis && redis.isOpen) {
    return redis;
  }

  if (isConnecting) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    try {
      redis = createRedisClient();
      await redis.connect();
      console.log('Redis cache handler connected');

      redis.on('error', (/** @type {any} */ err) => {
        console.error('Redis cache handler error:', err);
      });

      return redis;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      isConnecting = false;
      connectionPromise = null;
      // Return null to allow graceful degradation
      return null;
    }
  })();

  return connectionPromise;
}

// Handle process termination
process.on('SIGTERM', async () => {
  if (redis && redis.isOpen) {
    await redis.quit();
  }
});

const TAG_EXPIRATION_PREFIX = 'tag-expiration:';
const CACHE_PREFIX = 'nextjs-cache:';
const PENDING_CACHE_PREFIX = 'nextjs-pending-cache:';

/**
 * Serializes a ReadableStream to a Buffer
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {Promise<Buffer>}
 */
async function streamToBuffer(stream) {
  const chunks = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
      }
    }
  } catch (error) {
    console.error('Error reading stream:', error);
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch (error) {
      // Ignore errors when releasing lock
      console.warn('Warning: could not release reader lock:', error);
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Converts a Buffer back to a ReadableStream
 * @param {Buffer} buffer
 * @returns {ReadableStream<Uint8Array>}
 */
function bufferToStream(buffer) {
  return new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * @type {import('next/dist/server/lib/cache-handlers/types').CacheHandlerV2}
 */
const cacheHandler = {
  async get(cacheKey) {
    // console.log('RedisCacheHandler::get', cacheKey);
    const redisClient = await ensureRedisConnection();
    if (!redisClient) return undefined;

    try {
      // Check if there's a pending entry
      const isPending = await redisClient.exists(
        `${PENDING_CACHE_PREFIX}${cacheKey}`
      );
      if (isPending) {
        // Wait for the pending entry to complete
        let retries = 0;
        while (retries < 50) {
          // Max 5 seconds wait (50 * 100ms)
          const exists = await redisClient.exists(
            `${PENDING_CACHE_PREFIX}${cacheKey}`
          );
          if (!exists) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
          retries++;
        }
      }

      const cachedData = await redisClient.get(`${CACHE_PREFIX}${cacheKey}`);
      if (!cachedData) return undefined;

      try {
        const entry = JSON.parse(cachedData);
        // Convert serialized buffer back to ReadableStream
        const valueBuffer = Buffer.from(entry.valueBuffer, 'base64');
        entry.value = bufferToStream(valueBuffer);
        // Use optional chaining to avoid type error with delete
        entry.valueBuffer = undefined;

        return entry;
      } catch (error) {
        console.error('Error parsing cached data:', error);
        return undefined;
      }
    } catch (error) {
      console.error('Error in cache get:', error);
      return undefined;
    }
  },

  async set(cacheKey, pendingEntry) {
    // console.log('RedisCacheHandler::set', cacheKey);
    const redisClient = await ensureRedisConnection();
    if (!redisClient) return;

    try {
      // Mark this entry as pending
      await redisClient.set(`${PENDING_CACHE_PREFIX}${cacheKey}`, '1', {
        EX: 60,
      }); // 60s timeout

      try {
        const entry = await pendingEntry;

        // Check if entry and entry.value exist
        if (!entry || !entry.value) {
          console.warn('Cache entry or value is missing, skipping cache set');
          return;
        }

        // Serialize the ReadableStream to a buffer
        const valueBuffer = await streamToBuffer(entry.value);

        // Create a copy of the entry for storage
        const entryCopy = {
          ...entry,
          valueBuffer: valueBuffer.toString('base64'),
          // Set value to undefined instead of using delete
          value: undefined,
        };

        // Store in Redis with expiration based on entry.expire
        await redisClient.set(
          `${CACHE_PREFIX}${cacheKey}`,
          JSON.stringify(entryCopy),
          {
            EX: entry.expire,
          }
        );

        // Restore the stream in the original entry
        entry.value = bufferToStream(valueBuffer);
      } catch (error) {
        console.error('Error setting cache entry:', error);
      } finally {
        // Remove the pending marker
        await redisClient.del(`${PENDING_CACHE_PREFIX}${cacheKey}`);
      }
    } catch (error) {
      console.error('Error in cache set:', error);
    }
  },

  async refreshTags() {
    // console.log('RedisCacheHandler::refreshTags');
    // No implementation needed for single-server setup
    return;
  },

  async getExpiration(...tags) {
    // console.log('RedisCacheHandler::getExpiration', JSON.stringify(tags));

    if (tags.length === 0) return 0;

    const redisClient = await ensureRedisConnection();
    if (!redisClient) return 0;

    try {
      // Get all tag expiration timestamps
      const multi = redisClient.multi();
      for (const tag of tags) {
        multi.get(`${TAG_EXPIRATION_PREFIX}${tag}`);
      }

      const results = await multi.exec();

      if (!results) return 0;

      // Find the maximum timestamp from all tags
      let maxTimestamp = 0;
      for (const value of results) {
        // Cast the value to string to fix the type error
        if (!value) continue;
        const valueStr = String(value);
        const timestamp = parseInt(valueStr, 10);
        if (!isNaN(timestamp) && timestamp > maxTimestamp) {
          maxTimestamp = timestamp;
        }
      }

      return maxTimestamp;
    } catch (error) {
      console.error('Error in getExpiration:', error);
      return 0;
    }
  },

  async expireTags(...tags) {
    // console.log('RedisCacheHandler::expireTags', JSON.stringify(tags));

    if (tags.length === 0) return;

    const redisClient = await ensureRedisConnection();
    if (!redisClient) return;

    try {
      const now = Date.now();
      const multi = redisClient.multi();

      // Update tag expiration times
      for (const tag of tags) {
        multi.set(`${TAG_EXPIRATION_PREFIX}${tag}`, now.toString());
      }

      await multi.exec();
    } catch (error) {
      console.error('Error in expireTags:', error);
    }
  },
};

export default cacheHandler;
