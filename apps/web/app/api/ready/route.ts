import { connection, NextResponse } from 'next/server';
import { db, sql } from '@proposalsapp/db';
import { redis } from '@/lib/redis';

// Track when the app started
const startTime = Date.now();
const WARMUP_TIME = 10000; // 10 seconds warmup period

export async function GET() {
  // Readiness is meaningful only against the runtime dependencies. Without
  // this boundary, Cache Components can execute these probes during `next build`.
  await connection();

  const uptime = Date.now() - startTime;
  const isWarmedUp = uptime >= WARMUP_TIME;

  const checks = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    uptime,
    checks: {
      warmup: {
        status: isWarmedUp ? 'ok' : 'warming',
        message: isWarmedUp
          ? 'Application is warmed up'
          : `Warming up... ${Math.ceil((WARMUP_TIME - uptime) / 1000)}s remaining`,
        uptime,
      },
      database: await checkDatabase(),
      redis: await checkRedis(),
    },
  };

  // Determine overall status
  const allChecksOk = Object.values(checks.checks).every(
    (check) => check.status === 'ok'
  );

  checks.status = allChecksOk ? 'ready' : 'not_ready';

  return NextResponse.json(checks, {
    status: allChecksOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

async function checkDatabase() {
  try {
    // Simple query to check database connectivity using Kysely
    await sql`SELECT 1 as check`.execute(db);
    return {
      status: 'ok',
      message: 'Database connection is healthy',
    };
  } catch (error) {
    console.error('Database readiness check failed', error);
    return {
      status: 'error',
      message: 'Database connection failed',
    };
  }
}

async function checkRedis() {
  // Check if Redis URL is configured
  if (!process.env.REDIS_URL) {
    return {
      status: 'warning',
      message: 'Redis URL not configured',
    };
  }

  if (!redis) {
    return {
      status: 'error',
      message: 'Redis client not initialized',
    };
  }

  try {
    // Connect if not already connected
    if (!redis.isOpen) {
      await redis.connect();
    }

    // Ping Redis to check connectivity
    const pong = await redis.ping();

    return {
      status: 'ok',
      message: `Redis connection is healthy (${pong})`,
    };
  } catch (error) {
    console.error('Redis readiness check failed', error);
    return {
      status: 'error',
      message: 'Redis connection failed',
    };
  }
}
