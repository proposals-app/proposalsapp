import type { PiToolTransportMode } from './runtime/tool-transport';

const DEFAULT_DAO_CATEGORY_FILTERS: Record<string, number[]> = {
  arbitrum: [7, 8, 9],
  uniswap: [5, 8, 9, 10],
};

export interface PiAgentSettings {
  provider: string | null;
  model: string | null;
  thinking: string;
  configDir: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  toolTransport: PiToolTransportMode;
  contextWindow: number;
  sessionTimeoutMs: number;
  maxQueryCalls: number;
}

export interface MappingAgentConfig {
  port: number;
  logLevel: string;
  dryRun: boolean;
  runOnce: boolean;
  enabledDaoSlugs: string[];
  daoCategoryFilters: Record<string, number[]>;
  proposalIntervalMs: number;
  delegateIntervalMs: number;
  betterstackUrl: string | null;
  proposalConfidenceThreshold: number;
  delegateConfidenceThreshold: number;
  pi: PiAgentSettings;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatValue(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseToolTransportMode(
  value: string | undefined
): PiToolTransportMode {
  switch (value?.trim().toLowerCase()) {
    case 'native':
      return 'native';
    case 'text-actions':
      return 'text-actions';
    case 'auto':
    case undefined:
      return 'auto';
    default:
      return 'auto';
  }
}

function parseDaoCategoryFilters(
  value: string | undefined
): Record<string, number[]> {
  if (!value) {
    return DEFAULT_DAO_CATEGORY_FILTERS;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, number[]>;
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse MAPPING_AGENT_DAO_CATEGORY_FILTERS: ${String(error)}`,
      {
        cause: error,
      }
    );
  }
}

function parseEnabledDaos(
  value: string | undefined,
  daoCategoryFilters: Record<string, number[]>
): string[] {
  if (!value) {
    return Object.keys(daoCategoryFilters);
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(): MappingAgentConfig {
  const daoCategoryFilters = parseDaoCategoryFilters(
    process.env.MAPPING_AGENT_DAO_CATEGORY_FILTERS
  );
  const enabledDaoSlugs = parseEnabledDaos(
    process.env.MAPPING_AGENT_DAO_SLUGS,
    daoCategoryFilters
  );

  return {
    port: parseInteger(process.env.PORT, 3000),
    logLevel: process.env.LOG_LEVEL || 'info',
    dryRun: parseBoolean(process.env.MAPPING_AGENT_DRY_RUN),
    runOnce: parseBoolean(process.env.MAPPING_AGENT_RUN_ONCE),
    enabledDaoSlugs,
    daoCategoryFilters,
    proposalIntervalMs:
      parseInteger(process.env.MAPPING_AGENT_PROPOSAL_INTERVAL_SECONDS, 60) *
      1000,
    delegateIntervalMs:
      parseInteger(process.env.MAPPING_AGENT_DELEGATE_INTERVAL_SECONDS, 300) *
      1000,
    betterstackUrl: process.env.BETTERSTACK_KEY || null,
    proposalConfidenceThreshold: parseFloatValue(
      process.env.MAPPING_AGENT_PROPOSAL_CONFIDENCE_THRESHOLD,
      0.85
    ),
    delegateConfidenceThreshold: parseFloatValue(
      process.env.MAPPING_AGENT_DELEGATE_CONFIDENCE_THRESHOLD,
      0.9
    ),
    pi: {
      provider: process.env.MAPPING_AGENT_PI_PROVIDER || null,
      model: process.env.MAPPING_AGENT_PI_MODEL || null,
      thinking: process.env.MAPPING_AGENT_PI_THINKING || 'medium',
      configDir: process.env.MAPPING_AGENT_PI_DIR || null,
      baseUrl: process.env.MAPPING_AGENT_PI_BASE_URL || null,
      apiKey: process.env.MAPPING_AGENT_PI_API_KEY || null,
      toolTransport: parseToolTransportMode(
        process.env.MAPPING_AGENT_PI_LMSTUDIO_TOOL_TRANSPORT
      ),
      contextWindow: parseInteger(
        process.env.MAPPING_AGENT_PI_CONTEXT_WINDOW,
        131_072
      ),
      sessionTimeoutMs: parseInteger(
        process.env.MAPPING_AGENT_PI_SESSION_TIMEOUT_MS,
        300_000
      ),
      maxQueryCalls: parseInteger(
        process.env.MAPPING_AGENT_PI_MAX_QUERY_CALLS,
        20
      ),
    },
  };
}
