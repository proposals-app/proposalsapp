import { config as dotenv_config } from 'dotenv';

dotenv_config();

export interface Config {
  resendApiKey: string;
  fromEmail: string;
  port: number;
  betterstackKey?: string;
  notifications: {
    newProposalTimeframeMinutes: number;
    endingProposalTimeframeMinutes: number;
    newDiscussionTimeframeMinutes: number;
    notificationCooldownHours: number;
  };
  circuitBreaker: {
    enabled: boolean;
    threshold: number;
    timeout: number;
  };
  cronSchedule: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getOptionalBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getOptionalNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config: Config = {
  resendApiKey: getRequiredEnv('RESEND_API_KEY'),
  fromEmail: getOptionalEnv(
    'FROM_EMAIL',
    'Proposals.app <no-reply@proposals.app>'
  ),
  port: 3000,
  betterstackKey: process.env.BETTERSTACK_KEY,
  notifications: {
    newProposalTimeframeMinutes: getOptionalNumberEnv(
      'NEW_PROPOSAL_TIMEFRAME_MINUTES',
      5
    ),
    endingProposalTimeframeMinutes: getOptionalNumberEnv(
      'ENDING_PROPOSAL_TIMEFRAME_MINUTES',
      60
    ),
    newDiscussionTimeframeMinutes: getOptionalNumberEnv(
      'NEW_DISCUSSION_TIMEFRAME_MINUTES',
      5
    ),
    notificationCooldownHours: getOptionalNumberEnv(
      'NOTIFICATION_COOLDOWN_HOURS',
      24
    ),
  },
  circuitBreaker: {
    enabled: getOptionalBoolEnv('CIRCUIT_BREAKER_ENABLED', true),
    threshold: getOptionalNumberEnv('CIRCUIT_BREAKER_THRESHOLD', 5),
    timeout: getOptionalNumberEnv('CIRCUIT_BREAKER_TIMEOUT', 300000), // 5 minutes in ms
  },
  cronSchedule: getOptionalEnv('CRON_SCHEDULE', '* * * * *'), // Every minute by default
};

export function validateConfig(): void {
  // Additional validation logic if needed
}
