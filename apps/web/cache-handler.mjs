// @ts-check
import { createClient } from 'redis';

// Configure Redis client
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = createClient({ url: redisUrl });

// Connect to Redis
(async () => {
  await redis.connect();
  console.log('Redis cache handler connected');

  redis.on('error', (err) => {
    console.error('Redis cache handler error:', err);
  });
})();

// Handle process termination
process.on('SIGTERM', async () => {
  await redis.quit();
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
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
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
      controller.enqueue(buffer);
      controller.close();
    },
  });
}

/**
 * @type {import('next/dist/server/lib/cache-handlers/types').CacheHandlerV2}
 */
const cacheHandler = {
  async get(cacheKey) {
    // console.log('RedisCacheHandler::get', cacheKey);

    // Check if there's a pending entry
    const isPending = await redis.exists(`${PENDING_CACHE_PREFIX}${cacheKey}`);
    if (isPending) {
      // Wait for the pending entry to complete
      let retries = 0;
      while (retries < 50) {
        // Max 5 seconds wait (50 * 100ms)
        const exists = await redis.exists(`${PENDING_CACHE_PREFIX}${cacheKey}`);
        if (!exists) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries++;
      }
    }

    const cachedData = await redis.get(`${CACHE_PREFIX}${cacheKey}`);
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
  },

  async set(cacheKey, pendingEntry) {
    // console.log('RedisCacheHandler::set', cacheKey);

    // Mark this entry as pending
    await redis.set(`${PENDING_CACHE_PREFIX}${cacheKey}`, '1', { EX: 60 }); // 60s timeout

    try {
      const entry = await pendingEntry;

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
      await redis.set(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(entryCopy), {
        EX: entry.expire,
      });

      // Restore the stream in the original entry
      entry.value = bufferToStream(valueBuffer);
    } catch (error) {
      console.error('Error setting cache entry:', error);
    } finally {
      // Remove the pending marker
      await redis.del(`${PENDING_CACHE_PREFIX}${cacheKey}`);
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

    // Get all tag expiration timestamps
    const multi = redis.multi();
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
  },

  async expireTags(...tags) {
    // console.log('RedisCacheHandler::expireTags', JSON.stringify(tags));

    if (tags.length === 0) return;

    const now = Date.now();
    const multi = redis.multi();

    // Update tag expiration times
    for (const tag of tags) {
      multi.set(`${TAG_EXPIRATION_PREFIX}${tag}`, now.toString());
    }

    await multi.exec();
  },
};

export default cacheHandler;
