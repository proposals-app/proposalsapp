import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryProposalMappingData,
  attachProposalToGroup,
  declineProposalMapping,
} = vi.hoisted(() => ({
  queryProposalMappingData: vi.fn(),
  attachProposalToGroup: vi.fn(),
  declineProposalMapping: vi.fn(),
}));

vi.mock('./repository', () => ({
  queryProposalMappingData,
  attachProposalToGroup,
  declineProposalMapping,
}));

import { createProposalExtension } from './extension';

function registerTools() {
  type RegisteredTool = {
    name: string;
    execute: (...args: unknown[]) => unknown;
  };
  const tools = new Map<string, RegisteredTool>();

  createProposalExtension({
    daoId: 'dao-1',
    proposalId: 'proposal-1',
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

describe('createProposalExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not consume query budget when a successful proposal read result is too large to forward', async () => {
    queryProposalMappingData.mockResolvedValueOnce({
      rows: [
        {
          cooked: 'x'.repeat(160_000),
        },
      ],
      rowCount: 1,
    });

    const tools = registerTools();
    const queryTool = tools.get('query_proposal_mapping_data');
    const proposeTool = tools.get('propose_proposal_group_mapping');

    expect(queryTool).toBeDefined();
    expect(proposeTool).toBeDefined();

    const queryResult = parseTextResponse(
      await queryTool!.execute('tool-call-id', {
        sql: 'select cooked from discourse_topic',
      })
    );

    expect(queryResult).toMatchObject({
      ok: false,
      rowCount: 1,
      attemptedSql: 'select cooked from discourse_topic',
      budget: {
        queryCount: 0,
        minQueriesRemaining: 5,
        queryCallsRemaining: 30,
      },
    });
    expect(queryResult.error).toContain('too large to forward safely');
    expect(queryResult.responseChars).toBeGreaterThan(150_000);

    const proposeResult = parseTextResponse(
      await proposeTool!.execute('tool-call-id', {
        groupId: 'group-id',
        confidence: 1,
        reason: 'reason',
        evidenceIds: [],
      })
    );

    expect(attachProposalToGroup).not.toHaveBeenCalled();
    expect(proposeResult).toMatchObject({
      ok: false,
      error:
        'You must make at least 5 query_proposal_mapping_data calls before a decision tool is allowed.',
      budget: {
        queryCount: 0,
        minQueriesRemaining: 5,
        queryCallsRemaining: 30,
      },
    });
  });

  it('does not consume query budget when a proposal read query fails', async () => {
    queryProposalMappingData.mockRejectedValueOnce(new Error('syntax error'));

    const tools = registerTools();
    const queryTool = tools.get('query_proposal_mapping_data');
    const proposeTool = tools.get('propose_proposal_group_mapping');

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
        groupId: 'group-id',
        confidence: 1,
        reason: 'reason',
        evidenceIds: [],
      })
    );

    expect(attachProposalToGroup).not.toHaveBeenCalled();
    expect(proposeResult).toMatchObject({
      ok: false,
      error:
        'You must make at least 5 query_proposal_mapping_data calls before a decision tool is allowed.',
      budget: {
        queryCount: 0,
        minQueriesRemaining: 5,
        queryCallsRemaining: 30,
      },
    });
  });
});
