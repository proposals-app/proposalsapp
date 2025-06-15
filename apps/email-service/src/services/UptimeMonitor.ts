import type { DB } from '@proposalsapp/db';
import axios from 'axios';
import type { Kysely } from 'kysely';
import type { Express } from 'express';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: boolean;
    circuitBreakers?: {
      main: string;
      email: string;
    };
  };
  timestamp: string;
}

export class UptimeMonitor {
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private betterstackInterval: ReturnType<typeof setInterval> | null = null;
  private lastHealthStatus: 'healthy' | 'unhealthy' = 'healthy';

  constructor(
    private db: Kysely<DB>,
    private betterstackUrl?: string,
    private mainCircuitBreaker?: any,
    private emailCircuitBreaker?: any
  ) {}

  setupHealthEndpoint(app: Express): void {
    app.get('/health', async (req, res) => {
      try {
        const healthStatus = await this.getHealthStatus();

        if (healthStatus.status === 'healthy') {
          res.json(healthStatus);
        } else {
          res.status(500).json(healthStatus);
        }
      } catch (_error) {
        res.status(500).json({
          status: 'unhealthy',
          checks: { database: false },
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  start(): void {
    if (this.healthCheckInterval) {
      console.warn('Uptime monitor already started');
      return;
    }

    console.log('Starting uptime monitoring with health checks');

    // Start health monitoring every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30 * 1000);

    // Start Betterstack heartbeat every 30 seconds if configured
    if (this.betterstackUrl) {
      console.log('Starting Betterstack heartbeat monitoring');
      this.betterstackInterval = setInterval(() => {
        this.sendBetterstackHeartbeat();
      }, 30 * 1000);

      // Send initial heartbeat
      this.sendBetterstackHeartbeat();
    }

    // Perform initial health check
    this.performHealthCheck();
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.betterstackInterval) {
      clearInterval(this.betterstackInterval);
      this.betterstackInterval = null;
    }

    console.log('Uptime monitoring stopped');
  }

  async getHealthStatus(): Promise<HealthCheckResult> {
    const checks = {
      database: false,
      circuitBreakers: undefined as any,
    };

    try {
      // Check database connection
      await this.db.selectFrom('dao').select('id').limit(1).execute();
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
      checks.database = false;
    }

    // Check circuit breakers if available
    if (this.mainCircuitBreaker || this.emailCircuitBreaker) {
      checks.circuitBreakers = {
        main: this.mainCircuitBreaker?.getState() || 'DISABLED',
        email: this.emailCircuitBreaker?.getState() || 'DISABLED',
      };
    }

    const status: 'healthy' | 'unhealthy' = checks.database
      ? 'healthy'
      : 'unhealthy';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealthStatus();

      if (this.lastHealthStatus !== health.status) {
        console.log(
          `Health status changed: ${this.lastHealthStatus} -> ${health.status}`
        );
        this.lastHealthStatus = health.status;
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.lastHealthStatus = 'unhealthy';
    }
  }

  private async sendBetterstackHeartbeat(): Promise<void> {
    if (!this.betterstackUrl) return;

    try {
      // Only send heartbeat if service is healthy
      if (this.lastHealthStatus === 'healthy') {
        await axios.get(this.betterstackUrl, { timeout: 5000 });
        console.log('Betterstack heartbeat sent successfully');
      } else {
        console.log('Skipping Betterstack heartbeat - service is unhealthy');
      }
    } catch (error) {
      console.error('Betterstack heartbeat failed:', error);
    }
  }
}
