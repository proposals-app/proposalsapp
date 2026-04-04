import { afterEach, describe, expect, it, vi } from 'vitest';

describe('loadConfig', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('respects an explicit lmstudio base URL override', async () => {
    vi.stubEnv('MAPPING_AGENT_PI_PROVIDER', 'lmstudio');
    vi.stubEnv('MAPPING_AGENT_PI_BASE_URL', 'http://ai-box:2234/v1');

    const { loadConfig } = await import('./config');

    expect(loadConfig().pi.baseUrl).toBe('http://ai-box:2234/v1');
  });

  it('does not infer a base URL when none is configured', async () => {
    vi.stubEnv('MAPPING_AGENT_PI_PROVIDER', 'lmstudio');

    const { loadConfig } = await import('./config');

    expect(loadConfig().pi.baseUrl).toBeNull();
  });

  it('loads pi session guardrail settings', async () => {
    vi.stubEnv('MAPPING_AGENT_PI_CONTEXT_WINDOW', '131072');
    vi.stubEnv('MAPPING_AGENT_PI_SESSION_TIMEOUT_MS', '30000');
    vi.stubEnv('MAPPING_AGENT_PI_MAX_QUERY_CALLS', '4');

    const { loadConfig } = await import('./config');

    expect(loadConfig().pi).toEqual(
      expect.objectContaining({
        contextWindow: 131072,
        sessionTimeoutMs: 30000,
        maxQueryCalls: 4,
      })
    );
  });

  it('loads the LM Studio transport override', async () => {
    vi.stubEnv('MAPPING_AGENT_PI_LMSTUDIO_TOOL_TRANSPORT', 'text-actions');

    const { loadConfig } = await import('./config');

    expect(loadConfig().pi.toolTransport).toBe('text-actions');
  });
});
