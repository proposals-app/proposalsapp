import { createClient } from 'redis';

// Create Redis client
const redisUrl = process.env.REDIS_URL;

let redisClient: ReturnType<typeof createClient> | null = null;

if (redisUrl) {
  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  // Don't connect immediately - let individual functions handle connection
}

export const redis = redisClient;

// Helper function to ensure Redis is connected
export async function ensureRedisConnection() {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}