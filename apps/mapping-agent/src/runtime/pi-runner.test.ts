import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const createAgentSession = vi.fn();
const DefaultResourceLoader = vi.fn();
const SessionManager = {
  inMemory: vi.fn(),
};
const SettingsManager = {
  inMemory: vi.fn(),
};
const AuthStorage = {
  inMemory: vi.fn(),
};
const modelRegistry = {
  registerProvider: vi.fn(),
  find: vi.fn(),
};
const ModelRegistry = {
  create: vi.fn(() => modelRegistry),
  inMemory: vi.fn(() => modelRegistry),
};

vi.mock('@mariozechner/pi-coding-agent', () => ({
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
}));

let runPiAgent: typeof import('./pi-runner').runPiAgent;

describe('runPiAgent', () => {
  beforeAll(async () => {
    ({ runPiAgent } = await import('./pi-runner'));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    DefaultResourceLoader.mockImplementation(
      function mockResourceLoader(options) {
        return {
          options,
          reload: vi.fn().mockResolvedValue(undefined),
        };
      }
    );
    SessionManager.inMemory.mockReturnValue({
      kind: 'session-manager',
    });
    SettingsManager.inMemory.mockImplementation((settings) => ({
      settings,
    }));
    AuthStorage.inMemory.mockReturnValue({
      kind: 'auth-storage',
    });
    modelRegistry.registerProvider.mockReset();
    modelRegistry.find.mockReset();
  });

  it('uses an in-process pi session and captures multi-turn tool usage', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    const model = {
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    };
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        for (const listener of listeners) {
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-1',
            toolName: 'query_proposal_mapping_data',
            args: { sql: 'select * from current_case' },
          });
          listener({
            type: 'turn_end',
            turnIndex: 0,
            message: {
              role: 'assistant',
              content: [],
            },
            toolResults: [],
          });
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-2',
            toolName: 'query_proposal_mapping_data',
            args: {
              sql: 'select * from proposal_group_topics where dao_id = (select dao_id from current_case)',
            },
          });
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-3',
            toolName: 'propose_proposal_group_mapping',
            args: { groupId: 'group-1', confidence: 0.91 },
          });
          listener({
            type: 'turn_end',
            turnIndex: 1,
            message: {
              role: 'assistant',
              content: [],
            },
            toolResults: [],
          });
          listener({
            type: 'message_end',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Proposal mapping completed.',
                },
              ],
            },
          });
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue(model);
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    const extensionFactory = vi.fn();

    const result = await runPiAgent({
      extensionFactory,
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:2234/v1',
      contextWindow: 131_072,
      timeoutMs: 30_000,
      maxQueryCalls: 4,
    });

    expect(DefaultResourceLoader).toHaveBeenCalledWith(
      expect.objectContaining({
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        systemPrompt: 'system prompt',
        extensionFactories: [extensionFactory],
      })
    );
    expect(createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        model,
        thinkingLevel: 'off',
        tools: [],
      })
    );
    expect(session.setActiveToolsByName).toHaveBeenCalledWith([
      'query_proposal_mapping_data',
      'propose_proposal_group_mapping',
      'decline_proposal_group_mapping',
    ]);
    expect((session.agent as { toolExecution?: string }).toolExecution).toBe(
      'sequential'
    );
    expect(session.prompt).toHaveBeenCalledWith('resolve the mapping case');
    expect(session.dispose).toHaveBeenCalled();
    expect(result).toEqual({
      finalText: 'Proposal mapping completed.',
      toolCalls: [
        {
          args: { sql: 'select * from current_case' },
          name: 'query_proposal_mapping_data',
        },
        {
          args: {
            sql: 'select * from proposal_group_topics where dao_id = (select dao_id from current_case)',
          },
          name: 'query_proposal_mapping_data',
        },
        {
          args: { groupId: 'group-1', confidence: 0.91 },
          name: 'propose_proposal_group_mapping',
        },
      ],
      turnCount: 2,
      queryCallCount: 2,
      decisionToolCallCount: 1,
    });
  });

  it('registers a runtime model provider when a base URL is supplied', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        for (const listener of listeners) {
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-1',
            toolName: 'decline_delegate_mapping',
            args: { reason: 'done' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-1',
            toolName: 'decline_delegate_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
        }
      }),
      dispose: vi.fn(),
    };
    const model = {
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    };

    modelRegistry.find.mockReturnValue(model);
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: ['query_delegate_mapping_data'],
      queryToolName: 'query_delegate_mapping_data',
      decisionToolNames: [
        'propose_delegate_mapping',
        'decline_delegate_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:2234/v1',
      apiKey: 'lmstudio',
      contextWindow: 131_072,
      timeoutMs: 30_000,
      maxQueryCalls: 4,
    });

    expect(modelRegistry.registerProvider).toHaveBeenCalledWith(
      'lmstudio',
      expect.objectContaining({
        api: 'openai-completions',
        apiKey: 'lmstudio',
        baseUrl: 'http://ai-box:2234/v1',
        models: [
          expect.objectContaining({
            id: 'google/gemma-4-31b',
            compat: expect.objectContaining({
              maxTokensField: 'max_tokens',
              supportsDeveloperRole: false,
              supportsReasoningEffort: false,
              supportsStore: false,
              supportsStrictMode: false,
              supportsUsageInStreaming: false,
            }),
          }),
        ],
      })
    );
  });

  it('continues prompting until a decision tool resolves the case', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    let promptCallCount = 0;
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        promptCallCount += 1;

        for (const listener of listeners) {
          if (promptCallCount === 1) {
            listener({
              type: 'tool_execution_start',
              toolCallId: 'call-1',
              toolName: 'query_proposal_mapping_data',
              args: { sql: 'select * from current_case' },
            });
            listener({
              type: 'turn_end',
              turnIndex: 0,
              message: {
                role: 'assistant',
                content: [],
              },
              toolResults: [],
            });
            continue;
          }

          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-2',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'no confident match' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-2',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
          listener({
            type: 'turn_end',
            turnIndex: 1,
            message: {
              role: 'assistant',
              content: [],
            },
            toolResults: [],
          });
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    const result = await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:2234/v1',
      contextWindow: 131_072,
      timeoutMs: 30_000,
      maxQueryCalls: 20,
      minQueryCallsBeforeDecision: 1,
      requireResolvedDecision: true,
    });

    expect(session.prompt).toHaveBeenNthCalledWith(
      1,
      'resolve the mapping case'
    );
    expect(session.prompt).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'Prefer making about 9 more focused query_proposal_mapping_data call(s) before deciding'
      )
    );
    expect(result.decisionToolCallCount).toBe(1);
    expect(session.dispose).toHaveBeenCalled();
  });

  it('stops the session immediately after a resolved decision tool call', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        for (const listener of listeners) {
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-1',
            toolName: 'query_proposal_mapping_data',
            args: { sql: 'select * from current_case' },
          });
          listener({
            type: 'turn_end',
            turnIndex: 0,
            message: {
              role: 'assistant',
              content: [],
            },
            toolResults: [],
          });
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-2',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'no confident match' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-2',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });

          if (session.abort.mock.calls.length === 0) {
            listener({
              type: 'message_end',
              message: {
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: 'This text should never be emitted after a decision.',
                  },
                ],
              },
            });
          }
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    const result = await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:1234/v1',
      timeoutMs: 300_000,
      contextWindow: 131_072,
      maxQueryCalls: 20,
      minQueryCallsBeforeDecision: 1,
      requireResolvedDecision: true,
    });

    expect(session.abort).toHaveBeenCalledTimes(1);
    expect(result.finalText).toBe('');
    expect(result.decisionToolCallCount).toBe(1);
  });

  it('forces tool_choice required until a decision tool has been called', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    let promptCallCount = 0;
    let resolvePrompt: (() => void) | undefined;
    const session = {
      agent: {
        onPayload: vi.fn(async (payload) => ({
          ...payload,
          fromBaseHook: true,
        })),
      },
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(() => {
        promptCallCount += 1;

        if (promptCallCount === 1) {
          return new Promise<void>((resolve) => {
            resolvePrompt = resolve;
          });
        }

        for (const listener of listeners) {
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-1',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'done' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-1',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
        }

        return Promise.resolve();
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'proxy',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    const pendingRun = runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'proxy',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:2234/v1',
      contextWindow: 131_072,
      timeoutMs: 30_000,
      maxQueryCalls: 4,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(session.setActiveToolsByName).toHaveBeenCalled();

    const forcedPayload = await session.agent.onPayload({
      model: 'google/gemma-4-31b',
    });

    expect(forcedPayload).toEqual({
      fromBaseHook: true,
      model: 'google/gemma-4-31b',
      parallel_tool_calls: false,
      tool_choice: 'required',
    });

    resolvePrompt?.();
    await pendingRun;
  });

  it('reminds the model when the minimum query count has not been met yet', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    let promptCallCount = 0;
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        promptCallCount += 1;

        for (const listener of listeners) {
          if (promptCallCount === 1) {
            listener({
              type: 'tool_execution_start',
              toolCallId: 'call-1',
              toolName: 'query_proposal_mapping_data',
              args: { sql: 'select * from current_case' },
            });
            listener({
              type: 'turn_end',
              turnIndex: 0,
              message: {
                role: 'assistant',
                content: [],
              },
              toolResults: [],
            });
            continue;
          }

          if (promptCallCount === 2) {
            listener({
              type: 'tool_execution_start',
              toolCallId: 'call-2',
              toolName: 'query_proposal_mapping_data',
              args: { sql: 'select * from proposal_groups limit 5' },
            });
            listener({
              type: 'turn_end',
              turnIndex: 1,
              message: {
                role: 'assistant',
                content: [],
              },
              toolResults: [],
            });
            continue;
          }

          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-3',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'no confident match' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-3',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
          listener({
            type: 'turn_end',
            turnIndex: 2,
            message: {
              role: 'assistant',
              content: [],
            },
            toolResults: [],
          });
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    const result = await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:1234/v1',
      timeoutMs: 300_000,
      contextWindow: 131_072,
      maxQueryCalls: 20,
      minQueryCallsBeforeDecision: 2,
      requireResolvedDecision: true,
    });

    expect(session.prompt).toHaveBeenNthCalledWith(
      1,
      'resolve the mapping case'
    );
    expect(session.prompt).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('It is still too early to decide.')
    );
    expect(result.decisionToolCallCount).toBe(1);
    expect(result.queryCallCount).toBe(2);
  });

  it('nudges the model to decide after the soft query budget target is exceeded', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    let promptCallCount = 0;
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        promptCallCount += 1;

        for (const listener of listeners) {
          if (promptCallCount === 1) {
            listener({
              type: 'tool_execution_start',
              toolCallId: 'call-1',
              toolName: 'query_proposal_mapping_data',
              args: { sql: 'select * from proposal_groups limit 5' },
            });
            listener({
              type: 'turn_end',
              turnIndex: 0,
              message: {
                role: 'assistant',
                content: [],
              },
              toolResults: [],
            });
            continue;
          }

          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-2',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'forced decision after read budget exhaustion' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-2',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    const result = await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:1234/v1',
      timeoutMs: 300_000,
      contextWindow: 131_072,
      maxQueryCalls: 1,
      minQueryCallsBeforeDecision: 0,
      requireResolvedDecision: true,
    });

    expect(session.setActiveToolsByName).toHaveBeenCalledTimes(1);
    expect(session.setActiveToolsByName).toHaveBeenNthCalledWith(1, [
      'query_proposal_mapping_data',
      'propose_proposal_group_mapping',
      'decline_proposal_group_mapping',
    ]);
    expect(session.prompt).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('You have reached the maximum read budget')
    );
    expect(result.decisionToolCallCount).toBe(1);
  });

  it('nudges the model when a turn ends without any tool call', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    let promptCallCount = 0;
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        promptCallCount += 1;

        for (const listener of listeners) {
          if (promptCallCount === 1) {
            listener({
              type: 'message_end',
              message: {
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: 'I think I am ready.',
                  },
                ],
              },
            });
            listener({
              type: 'turn_end',
              turnIndex: 0,
              message: {
                role: 'assistant',
                content: [],
              },
              toolResults: [],
            });
            continue;
          }

          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-1',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'ending with a tool call now' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-1',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: [
        'query_proposal_mapping_data',
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:1234/v1',
      timeoutMs: 300_000,
      contextWindow: 131_072,
      maxQueryCalls: 20,
      minQueryCallsBeforeDecision: 0,
      requireResolvedDecision: true,
    });

    expect(session.prompt).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('You ended the last turn without a tool call.')
    );
  });

  it('uses the LM Studio text-action transport when talking to an lmstudio base URL', async () => {
    const listeners: Array<(event: unknown) => void> = [];
    const session = {
      agent: {},
      subscribe: vi.fn((listener) => {
        listeners.push(listener);
        return vi.fn();
      }),
      setActiveToolsByName: vi.fn(),
      abort: vi.fn(async () => undefined),
      prompt: vi.fn(async () => {
        for (const listener of listeners) {
          listener({
            type: 'tool_execution_start',
            toolCallId: 'call-1',
            toolName: 'decline_proposal_group_mapping',
            args: { reason: 'done' },
          });
          listener({
            type: 'tool_execution_end',
            toolCallId: 'call-1',
            toolName: 'decline_proposal_group_mapping',
            isError: false,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ declined: true }),
                },
              ],
            },
          });
        }
      }),
      dispose: vi.fn(),
    };

    modelRegistry.find.mockReturnValue({
      provider: 'lmstudio',
      id: 'google/gemma-4-31b',
    });
    createAgentSession.mockResolvedValue({
      session,
      extensionsResult: {
        extensions: [],
        errors: [],
        runtime: {},
      },
    });

    await runPiAgent({
      extensionFactory: vi.fn(),
      activeToolNames: ['query_proposal_mapping_data'],
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
      systemPrompt: 'system prompt',
      prompt: 'resolve the mapping case',
      provider: 'lmstudio',
      model: 'google/gemma-4-31b',
      thinking: 'off',
      baseUrl: 'http://ai-box:1234/v1',
      timeoutMs: 30_000,
      contextWindow: 131_072,
      maxQueryCalls: 4,
    });

    expect(typeof (session.agent as { streamFn?: unknown }).streamFn).toBe(
      'function'
    );
    expect(
      (session.agent as { onPayload?: unknown }).onPayload
    ).toBeUndefined();
  });
});
