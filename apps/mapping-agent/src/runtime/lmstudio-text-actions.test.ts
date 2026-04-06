import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Type } from '@sinclair/typebox';

const createCompletion = vi.fn();

vi.mock('openai', () => {
  class OpenAI {
    chat = {
      completions: {
        create: createCompletion,
      },
    };
  }

  return {
    default: OpenAI,
  };
});

import {
  createLmStudioTextActionStreamFn,
  formatStructuredToolResult,
} from './lmstudio-text-actions';

describe('createLmStudioTextActionStreamFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses alternate bracketed tool wrappers into tool calls', async () => {
    createCompletion.mockResolvedValue({
      id: 'resp_1',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content:
              '[PROPOSE_DELEGATE_MAPPING]{"mappingType":"delegate_to_voter","targetId":"voter-id","confidence":1,"reason":"Strong proof","evidenceIds":["source-id","target-id"]}[END_PROPOSE_DELEGATE_MAPPING]',
          },
        },
      ],
    });

    const streamFn = createLmStudioTextActionStreamFn();
    const stream = (await streamFn(
      {
        api: 'openai-completions',
        provider: 'lmstudio',
        id: 'google/gemma-4-26b-a4b',
        name: 'Gemma 4 26B A4B',
        reasoning: false,
        input: ['text'],
        contextWindow: 262_144,
        maxTokens: 4_096,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        baseUrl: 'http://ai-box:1234/v1',
      },
      {
        systemPrompt: 'system prompt',
        messages: [],
        tools: [
          {
            name: 'propose_delegate_mapping',
            description: 'Propose delegate mapping',
            parameters: Type.Object({}),
          },
        ],
      },
      {}
    )) as unknown as {
      result: () => Promise<{
        stopReason?: string;
        content: Array<{
          type: string;
          name?: string;
          arguments?: unknown;
        }>;
      }>;
    };

    const result = await stream.result();

    expect(result.stopReason).toBe('toolUse');
    expect(result.content).toEqual([
      expect.objectContaining({
        type: 'toolCall',
        name: 'propose_delegate_mapping',
        arguments: {
          mappingType: 'delegate_to_voter',
          targetId: 'voter-id',
          confidence: 1,
          reason: 'Strong proof',
          evidenceIds: ['source-id', 'target-id'],
        },
      }),
    ]);
  });

  it('forwards structured query errors back into the model context clearly', async () => {
    const forwarded = formatStructuredToolResult({
      role: 'tool',
      toolName: 'query_delegate_mapping_data',
      toolCallId: 'tool_1',
      timestamp: Date.now(),
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: false,
            error: 'column x does not exist',
            attemptedSql: 'select x from y',
            budget: {
              queryCount: 4,
              minQueriesRemaining: 1,
            },
            warning: 'Wrap up soon.',
          }),
        },
      ],
    } as never);

    expect(forwarded).toContain('STATUS: query failed');
    expect(forwarded).toContain('ERROR: column x does not exist');
    expect(forwarded).toContain('ATTEMPTED_SQL: select x from y');
    expect(forwarded).toContain(
      'NOTE: failed read queries do not advance the read budget.'
    );
    expect(forwarded).toContain(
      'BUDGET_JSON: {"queryCount":4,"minQueriesRemaining":1}'
    );
    expect(forwarded).toContain('WARNING: Wrap up soon.');
    expect(forwarded).toContain(
      'RAW_JSON: {"ok":false,"error":"column x does not exist","attemptedSql":"select x from y","budget":{"queryCount":4,"minQueriesRemaining":1},"warning":"Wrap up soon."}'
    );
  });
});
