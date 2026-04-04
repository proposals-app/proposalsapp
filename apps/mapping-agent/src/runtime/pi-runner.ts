import { resolve } from 'node:path';
import type { Api, Model } from '@mariozechner/pi-ai';
import type { ThinkingLevel } from '@mariozechner/pi-agent-core';
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
  type ExtensionFactory,
} from '@mariozechner/pi-coding-agent';
import { createLmStudioTextActionStreamFn } from './lmstudio-text-actions';
import {
  resolvePiToolTransport,
  type PiToolTransportMode,
} from './tool-transport';

const DEFAULT_MAX_TOKENS = 4_096;
const DEFAULT_API_KEY = 'lmstudio';
const DEFAULT_SOFT_DECISION_QUERY_TARGET = 10;
const DEFAULT_HURRY_QUERY_THRESHOLD = 20;

export interface RunPiAgentInput {
  extensionFactory: ExtensionFactory;
  activeToolNames: string[];
  queryToolName: string;
  decisionToolNames: string[];
  systemPrompt: string;
  prompt: string;
  provider: string;
  model: string;
  thinking: string;
  configDir?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
  toolTransportMode?: PiToolTransportMode;
  contextWindow: number;
  timeoutMs: number;
  decisionGraceMs?: number;
  maxQueryCalls: number;
  minQueryCallsBeforeDecision?: number;
  requireResolvedDecision?: boolean;
  onEvent?: (event: PiAgentObservedEvent) => void;
}

export type PiAgentObservedEvent =
  | {
      type: 'assistant_text_delta';
      delta: string;
      text: string;
    }
  | {
      type: 'assistant_message_end';
      text: string;
    }
  | {
      type: 'tool_execution_start';
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: 'tool_execution_update';
      toolCallId: string;
      toolName: string;
      args: unknown;
      partialResult: unknown;
    }
  | {
      type: 'tool_execution_end';
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError: boolean;
    }
  | {
      type: 'turn_end';
      turnCount: number;
    };

export interface PiAgentRunResult {
  finalText: string;
  toolCalls: Array<{
    name: string;
    args: unknown;
  }>;
  turnCount: number;
  queryCallCount: number;
  decisionToolCallCount: number;
}

export class PiAgentSessionAbortedError extends Error {
  constructor(
    message: string,
    readonly result: PiAgentRunResult
  ) {
    super(message);
    this.name = 'PiAgentSessionAbortedError';
  }
}

type PiThinkingLevel = ThinkingLevel | 'off';

function normalizeThinkingLevel(value: string): PiThinkingLevel {
  switch (value) {
    case 'off':
    case 'minimal':
    case 'low':
    case 'medium':
    case 'high':
    case 'xhigh':
      return value;
    default:
      return 'medium';
  }
}

function extractAssistantText(message: { content?: unknown }): string {
  const content = message.content;
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .flatMap((block) => {
      if (!block || typeof block !== 'object') {
        return [];
      }

      const typedBlock = block as {
        type?: unknown;
        text?: unknown;
      };

      if (typedBlock.type !== 'text' || typeof typedBlock.text !== 'string') {
        return [];
      }

      return [typedBlock.text];
    })
    .join('\n')
    .trim();
}

function createModelRegistryForRun(input: RunPiAgentInput): {
  model: Model<Api>;
  modelRegistry: ModelRegistry;
  authStorage: AuthStorage;
} {
  const authStorage = AuthStorage.inMemory();
  const modelRegistry = input.configDir
    ? ModelRegistry.create(authStorage, resolve(input.configDir, 'models.json'))
    : ModelRegistry.inMemory(authStorage);

  if (input.baseUrl) {
    modelRegistry.registerProvider(input.provider, {
      api: 'openai-completions',
      apiKey: input.apiKey ?? DEFAULT_API_KEY,
      baseUrl: input.baseUrl,
      models: [
        {
          id: input.model,
          name: input.model,
          reasoning: false,
          input: ['text'],
          contextWindow: input.contextWindow,
          maxTokens: DEFAULT_MAX_TOKENS,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
          compat: {
            ...(input.provider === 'lmstudio'
              ? {
                  supportsStore: false,
                  supportsDeveloperRole: false,
                  supportsReasoningEffort: false,
                  supportsUsageInStreaming: false,
                  supportsStrictMode: false,
                  maxTokensField: 'max_tokens' as const,
                }
              : {
                  supportsDeveloperRole: false,
                  supportsReasoningEffort: false,
                }),
          },
        },
      ],
    });
  }

  const model = modelRegistry.find(input.provider, input.model);
  if (!model) {
    throw new Error(
      `Unable to resolve pi model ${input.provider}/${input.model}`
    );
  }

  return {
    model,
    modelRegistry,
    authStorage,
  };
}

function applyEventToResult(
  event: AgentSessionEvent,
  result: PiAgentRunResult,
  input: Pick<
    RunPiAgentInput,
    'queryToolName' | 'decisionToolNames' | 'maxQueryCalls'
  >,
  options?: {
    ignoreAssistantMessages?: boolean;
  }
): void {
  if (event.type === 'tool_execution_start') {
    result.toolCalls.push({
      name: event.toolName,
      args: event.args,
    });

    if (event.toolName === input.queryToolName) {
      result.queryCallCount += 1;
    }

    if (input.decisionToolNames.includes(event.toolName)) {
      result.decisionToolCallCount += 1;
    }
    return;
  }

  if (event.type === 'turn_end') {
    result.turnCount += 1;
    return;
  }

  if (event.type === 'message_end' && event.message.role === 'assistant') {
    if (options?.ignoreAssistantMessages) {
      return;
    }

    const nextText = extractAssistantText(event.message);
    if (nextText) {
      result.finalText = nextText;
    }
  }
}

function extractToolResultJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const toolResult = value as {
    content?: Array<{
      type?: unknown;
      text?: unknown;
    }>;
  };
  const text = toolResult.content
    ?.filter(
      (
        block
      ): block is {
        type: 'text';
        text: string;
      } => block?.type === 'text' && typeof block.text === 'string'
    )
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isDecisionResolvedPayload(value: unknown): boolean {
  const parsed = extractToolResultJson(value);
  if (!parsed) {
    return false;
  }

  return parsed.accepted === true || parsed.declined === true;
}

export async function runPiAgent(
  input: RunPiAgentInput
): Promise<PiAgentRunResult> {
  const toolTransport = resolvePiToolTransport({
    provider: input.provider,
    model: input.model,
    baseUrl: input.baseUrl,
    configuredMode: input.toolTransportMode,
  });
  const useLmStudioTextActions = toolTransport === 'text-actions';
  const thinkingLevel = normalizeThinkingLevel(input.thinking);
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    systemPrompt: input.systemPrompt,
    extensionFactories: [input.extensionFactory],
  });
  await resourceLoader.reload();

  const { authStorage, model, modelRegistry } =
    createModelRegistryForRun(input);
  const { session } = await createAgentSession({
    cwd: process.cwd(),
    authStorage,
    model,
    modelRegistry,
    thinkingLevel: thinkingLevel as ThinkingLevel,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: {
        enabled: false,
      },
      retry: {
        enabled: true,
        maxRetries: 2,
      },
      defaultProvider: input.provider,
      defaultModel: input.model,
      defaultThinkingLevel: thinkingLevel,
    }),
    tools: [],
  });
  session.agent.toolExecution = 'sequential';
  if (useLmStudioTextActions) {
    session.agent.streamFn = createLmStudioTextActionStreamFn();
  }
  session.setActiveToolsByName(input.activeToolNames);

  const result: PiAgentRunResult = {
    finalText: '',
    toolCalls: [],
    turnCount: 0,
    queryCallCount: 0,
    decisionToolCallCount: 0,
  };
  const minQueryCallsBeforeDecision = input.minQueryCallsBeforeDecision ?? 0;
  const requireResolvedDecision = input.requireResolvedDecision ?? false;
  const startedAtMs = Date.now();
  let currentAssistantText = '';
  let abortReason: 'resolved' | null = null;
  let abortPromise: Promise<void> | null = null;
  let decisionResolved = false;
  if (!useLmStudioTextActions) {
    const baseOnPayload = session.agent.onPayload;
    session.agent.onPayload = async (payload, currentModel) => {
      const nextPayload =
        (await baseOnPayload?.(payload, currentModel)) ?? payload;

      if (decisionResolved) {
        return nextPayload;
      }

      if (
        !nextPayload ||
        typeof nextPayload !== 'object' ||
        Array.isArray(nextPayload)
      ) {
        return nextPayload;
      }

      return {
        ...(nextPayload as Record<string, unknown>),
        tool_choice: 'required',
        ...(input.baseUrl ? { parallel_tool_calls: false } : {}),
      };
    };
  }
  const abortSession = (reason: 'resolved') => {
    if (abortReason) {
      return;
    }

    abortReason = reason;
    abortPromise = session.abort().catch(() => undefined);
  };
  const unsubscribe = session.subscribe((event) => {
    applyEventToResult(event, result, input, {
      ignoreAssistantMessages: decisionResolved,
    });

    if (event.type === 'message_start' && event.message.role === 'assistant') {
      if (decisionResolved) {
        return;
      }

      currentAssistantText = '';
    }

    if (
      event.type === 'message_update' &&
      event.message.role === 'assistant' &&
      event.assistantMessageEvent.type === 'text_delta'
    ) {
      if (decisionResolved) {
        return;
      }

      currentAssistantText += event.assistantMessageEvent.delta;
      input.onEvent?.({
        type: 'assistant_text_delta',
        delta: event.assistantMessageEvent.delta,
        text: currentAssistantText,
      });
    }

    if (event.type === 'message_end' && event.message.role === 'assistant') {
      if (decisionResolved) {
        return;
      }

      input.onEvent?.({
        type: 'assistant_message_end',
        text: extractAssistantText(event.message),
      });
    }

    if (event.type === 'tool_execution_start') {
      input.onEvent?.({
        type: 'tool_execution_start',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
    }

    if (event.type === 'tool_execution_update') {
      input.onEvent?.({
        type: 'tool_execution_update',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        partialResult: event.partialResult,
      });
    }

    if (event.type === 'tool_execution_end') {
      if (
        input.decisionToolNames.includes(event.toolName) &&
        isDecisionResolvedPayload(event.result)
      ) {
        decisionResolved = true;
        abortSession('resolved');
      }

      input.onEvent?.({
        type: 'tool_execution_end',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      });
    }

    if (event.type === 'turn_end') {
      input.onEvent?.({
        type: 'turn_end',
        turnCount: result.turnCount,
      });
    }
  });
  try {
    const prompts = [input.prompt];
    while (!abortReason) {
      const nextPrompt = prompts.shift();
      if (!nextPrompt) {
        break;
      }

      const toolCallCountBeforeTurn = result.toolCalls.length;
      await session.prompt(nextPrompt);

      if (abortReason === 'resolved') {
        break;
      }

      const madeToolCallThisTurn =
        result.toolCalls.length > toolCallCountBeforeTurn;
      const elapsedMs = Date.now() - startedAtMs;
      const isPastReadBudget = result.queryCallCount >= input.maxQueryCalls;
      const isHurryPhase =
        result.queryCallCount >=
          Math.min(DEFAULT_HURRY_QUERY_THRESHOLD, input.maxQueryCalls) ||
        elapsedMs >= input.timeoutMs;
      const isBeforeSoftDecisionTarget =
        result.queryCallCount < DEFAULT_SOFT_DECISION_QUERY_TARGET;

      if (!madeToolCallThisTurn) {
        prompts.push(
          [
            'Continue this same mapping case.',
            'You ended the last turn without a tool call.',
            `End the next turn with exactly one tool call: ${input.queryToolName}, ${input.decisionToolNames.join(', ')}.`,
            'Do not stop with plain text.',
          ].join(' ')
        );
        continue;
      }

      if (
        result.queryCallCount < minQueryCallsBeforeDecision ||
        (requireResolvedDecision && !decisionResolved)
      ) {
        if (result.queryCallCount < minQueryCallsBeforeDecision) {
          const remainingQueries = Math.max(
            0,
            minQueryCallsBeforeDecision - result.queryCallCount
          );
          prompts.push(
            [
              'Continue this same mapping case.',
              `You have made ${result.queryCallCount} ${input.queryToolName} call(s) so far.`,
              `It is still too early to decide. Make at least ${remainingQueries} more focused ${input.queryToolName} call(s) before using ${input.decisionToolNames.join(
                ' or '
              )}.`,
              'Make one query tool call in the next turn.',
            ].join(' ')
          );
          continue;
        }

        if (isPastReadBudget) {
          prompts.push(
            [
              'Continue this same mapping case.',
              `You have reached the maximum read budget with ${result.queryCallCount} query call(s).`,
              `The read tool will no longer be accepted. End the next turn with ${input.decisionToolNames.join(
                ' or '
              )}.`,
              'Do not call the read tool again.',
              'End the next turn with exactly one tool call.',
            ].join(' ')
          );
          continue;
        }

        if (isBeforeSoftDecisionTarget) {
          const remainingSoftQueries = Math.max(
            0,
            DEFAULT_SOFT_DECISION_QUERY_TARGET - result.queryCallCount
          );
          prompts.push(
            [
              'Continue this same mapping case.',
              `You have made ${result.queryCallCount} ${input.queryToolName} call(s), which is enough to decide if the evidence is already decisive.`,
              `Prefer making about ${remainingSoftQueries} more focused ${input.queryToolName} call(s) before deciding unless the evidence is already strong enough.`,
              'End the next turn with exactly one tool call.',
            ].join(' ')
          );
          continue;
        }

        if (isHurryPhase) {
          prompts.push(
            [
              'Continue this same mapping case.',
              `You are past the hurry threshold with ${result.queryCallCount} query call(s) and about ${Math.ceil(
                elapsedMs / 1000
              )} seconds elapsed.`,
              `Prefer a decision via ${input.decisionToolNames.join(
                ' or '
              )}, unless one more focused ${input.queryToolName} call is truly necessary.`,
              'End the next turn with exactly one tool call.',
            ].join(' ')
          );
          continue;
        }

        prompts.push(
          [
            'Continue this same mapping case.',
            `You have made ${result.queryCallCount} ${input.queryToolName} call(s).`,
            `Use the latest evidence to either make one more focused ${input.queryToolName} call or call ${input.decisionToolNames.join(
              ' or '
            )}.`,
            'End the next turn with exactly one tool call.',
          ].join(' ')
        );
      }
    }

    if (abortPromise) {
      await abortPromise;
    }

    return result;
  } catch (error) {
    if (abortPromise) {
      await abortPromise;
    }

    if (abortReason === 'resolved') {
      return result;
    }

    throw error;
  } finally {
    unsubscribe();
    session.dispose();
  }
}
