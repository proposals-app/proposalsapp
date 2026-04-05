import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryDelegateMappingData,
  proposeDelegateMapping,
  declineDelegateMapping,
} = vi.hoisted(() => ({
  queryDelegateMappingData: vi.fn(),
  proposeDelegateMapping: vi.fn(),
  declineDelegateMapping: vi.fn(),
}));

vi.mock('./repository', () => ({
  queryDelegateMappingData,
  proposeDelegateMapping,
  declineDelegateMapping,
}));

import { createDelegateExtension } from './extension';

function registerTools() {
  type RegisteredTool = {
    name: string;
    execute: (...args: unknown[]) => unknown;
  };
  const tools = new Map<string, RegisteredTool>();

  createDelegateExtension({
    daoId: 'dao-1',
    delegateId: 'delegate-1',
    allowedCategoryIds: [],
    threshold: 0.8,
    budget: {
      startedAtMs: Date.now(),
      timeoutMs: 300_000,
      maxQueryCalls: 30,
    },
  })({
    registerTool(definition: RegisteredTool) {
      tools.set(definition.name, definition);
    },
  } as never);

  return tools;
}

function parseTextResponse(response: unknown) {
  const text = (
    response as {
      content: Array<{
        type: string;
        text: string;
      }>;
    }
  ).content[0]?.text;

  return JSON.parse(text);
}

describe('createDelegateExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not consume query budget when a read query fails', async () => {
    queryDelegateMappingData.mockRejectedValueOnce(new Error('syntax error'));

    const tools = registerTools();
    const queryTool = tools.get('query_delegate_mapping_data');
    const proposeTool = tools.get('propose_delegate_mapping');

    expect(queryTool).toBeDefined();
    expect(proposeTool).toBeDefined();

    const queryResult = parseTextResponse(
      await queryTool!.execute('tool-call-id', {
        sql: 'select broken from missing_table',
      })
    );

    expect(queryResult).toMatchObject({
      ok: false,
      error: 'syntax error',
      attemptedSql: 'select broken from missing_table',
      budget: {
        queryCount: 0,
        minQueriesRemaining: 5,
        queryCallsRemaining: 30,
      },
    });

    const proposeResult = parseTextResponse(
      await proposeTool!.execute('tool-call-id', {
        mappingType: 'delegate_to_voter',
        targetId: 'target-id',
        confidence: 1,
        reason: 'reason',
        evidenceIds: [],
      })
    );

    expect(proposeDelegateMapping).not.toHaveBeenCalled();
    expect(proposeResult).toMatchObject({
      ok: false,
      error:
        'You must make at least 5 query_delegate_mapping_data calls before a decision tool is allowed.',
      budget: {
        queryCount: 0,
        minQueriesRemaining: 5,
        queryCallsRemaining: 30,
      },
    });
  });
});
