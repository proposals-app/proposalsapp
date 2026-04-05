import OpenAI from 'openai';
import type { StreamFn } from '@mariozechner/pi-agent-core';
import type {
  AssistantMessage,
  Context,
  Message,
  TextContent,
  ThinkingContent,
  Tool,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from '@mariozechner/pi-ai';

class LocalAssistantMessageEventStream
  implements AsyncIterable<import('@mariozechner/pi-ai').AssistantMessageEvent>
{
  private queue: import('@mariozechner/pi-ai').AssistantMessageEvent[] = [];
  private waiting: Array<
    (
      value: IteratorResult<import('@mariozechner/pi-ai').AssistantMessageEvent>
    ) => void
  > = [];
  private done = false;
  private readonly finalResultPromise: Promise<AssistantMessage>;
  private resolveFinalResult!: (message: AssistantMessage) => void;

  constructor() {
    this.finalResultPromise = new Promise<AssistantMessage>((resolve) => {
      this.resolveFinalResult = resolve;
    });
  }

  push(event: import('@mariozechner/pi-ai').AssistantMessageEvent): void {
    if (this.done) {
      return;
    }

    if (event.type === 'done') {
      this.done = true;
      this.resolveFinalResult(event.message);
    }

    if (event.type === 'error') {
      this.done = true;
      this.resolveFinalResult(event.error);
    }

    const waiter = this.waiting.shift();
    if (waiter) {
      waiter({
        value: event,
        done: false,
      });
      return;
    }

    this.queue.push(event);
  }

  end(result?: AssistantMessage): void {
    this.done = true;

    if (result) {
      this.resolveFinalResult(result);
    }

    while (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      waiter?.({
        value: undefined,
        done: true,
      });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<
    import('@mariozechner/pi-ai').AssistantMessageEvent
  > {
    while (true) {
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) {
          yield next;
          continue;
        }
      }

      if (this.done) {
        return;
      }

      const result = await new Promise<
        IteratorResult<import('@mariozechner/pi-ai').AssistantMessageEvent>
      >((resolve) => {
        this.waiting.push(resolve);
      });

      if (result.done || !result.value) {
        return;
      }

      yield result.value;
    }
  }

  result(): Promise<AssistantMessage> {
    return this.finalResultPromise;
  }
}

interface TextToolAction {
  tool: string;
  arguments: Record<string, unknown>;
}

interface OpenAIMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_LMSTUDIO_MAX_TOKENS = 4_096;
const DEFAULT_LMSTUDIO_TEMPERATURE = 0;
const MAX_INVALID_RESPONSE_REPAIR_ATTEMPTS = 2;

function textFromUserMessage(message: UserMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function textFromToolResult(message: ToolResultMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function textFromAssistantMessage(message: AssistantMessage): string {
  const lines: string[] = [];

  for (const block of message.content) {
    if (block.type === 'text' && block.text.trim()) {
      lines.push(block.text.trim());
      continue;
    }

    if (block.type === 'toolCall') {
      lines.push(
        `[TOOL_REQUEST]${JSON.stringify({
          name: block.name,
          arguments: block.arguments,
        })}[END_TOOL_REQUEST]`
      );
    }
  }

  return lines.join('\n').trim();
}

function toPlainTextMessages(messages: Message[]): Message[] {
  const plainMessages: Message[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      const text = textFromUserMessage(message);
      if (!text) {
        continue;
      }

      plainMessages.push({
        role: 'user',
        content: text,
        timestamp: message.timestamp,
      });
      continue;
    }

    if (message.role === 'assistant') {
      const text = textFromAssistantMessage(message);
      if (!text) {
        continue;
      }

      plainMessages.push({
        ...message,
        content: [
          {
            type: 'text',
            text,
          },
        ],
      });
      continue;
    }

    const toolText = textFromToolResult(message);
    plainMessages.push({
      role: 'user',
      content: [
        `Tool result for ${message.toolName} (${message.toolCallId}).`,
        toolText || '(empty tool result)',
        'Decide on the next single tool request or final answer.',
      ].join('\n\n'),
      timestamp: message.timestamp,
    });
  }

  return plainMessages;
}

function buildToolProtocol(tools: Tool[]): string {
  const renderedTools = tools
    .map((tool) =>
      [
        `- ${tool.name}: ${tool.description}`,
        `  Parameters schema: ${JSON.stringify(tool.parameters)}`,
      ].join('\n')
    )
    .join('\n');

  return [
    'Tool transport protocol:',
    '- Native function calling is disabled for this model.',
    '- If you want to use a tool, respond with this exact format and no markdown fences:',
    '[TOOL_REQUEST]{"name":"tool_name","arguments":{}}[END_TOOL_REQUEST]',
    '- Make at most one tool request per response.',
    '- Use only tool names from the available tools list.',
    '- If you request a tool, there must be no other visible text in the message.',
    '- After each tool result, either request one more tool or finish.',
    '- If you finish without calling a tool, reply with plain text.',
    '',
    'Available tools:',
    renderedTools,
  ].join('\n');
}

function buildPlainTextContext(context: Context): Context {
  const tools = context.tools ?? [];
  const toolProtocol = buildToolProtocol(tools);

  return {
    systemPrompt: [context.systemPrompt?.trim(), toolProtocol]
      .filter(Boolean)
      .join('\n\n'),
    messages: toPlainTextMessages(context.messages),
  };
}

function toOpenAIMessages(context: Context): OpenAIMessageParam[] {
  const messages: OpenAIMessageParam[] = [];

  if (context.systemPrompt?.trim()) {
    messages.push({
      role: 'system',
      content: context.systemPrompt.trim(),
    });
  }

  for (const message of context.messages) {
    if (message.role === 'user') {
      const text = textFromUserMessage(message);
      if (!text) {
        continue;
      }

      messages.push({
        role: 'user',
        content: text,
      });
      continue;
    }

    if (message.role === 'assistant') {
      const text = textFromAssistantMessage(message);
      if (!text) {
        continue;
      }

      messages.push({
        role: 'assistant',
        content: text,
      });
      continue;
    }

    const toolText = textFromToolResult(message);
    messages.push({
      role: 'user',
      content: [
        `Tool result for ${message.toolName} (${message.toolCallId}).`,
        toolText || '(empty tool result)',
        'Decide on the next single tool request or final answer.',
      ].join('\n\n'),
    });
  }

  return messages;
}

function extractCandidatePayloads(value: string): string[] {
  const matches = [
    ...value.matchAll(/\[TOOL_REQUEST\]\s*([\s\S]*?)\s*\[END_TOOL_REQUEST\]/gi),
  ];
  if (matches.length > 0) {
    return matches
      .map((match) => match[1]?.trim())
      .filter((candidate): candidate is string => Boolean(candidate));
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('[TOOL_REQUEST]')) {
    const stripped = trimmed.slice('[TOOL_REQUEST]'.length).trim();
    return stripped ? [stripped] : [];
  }

  if (trimmed.startsWith('```')) {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch?.[1]) {
      return [fenceMatch[1].trim()];
    }
  }

  return [trimmed];
}

function normalizeBracketedToolName(value: string): string {
  return value.trim().toLowerCase();
}

function extractBracketedToolAction(
  value: string,
  toolNames: Set<string>
): TextToolAction | null {
  const matches = [
    ...value.matchAll(/\[([A-Z][A-Z0-9_]*)\]\s*([\s\S]*?)\s*\[END_\1\]/g),
  ].reverse();

  for (const match of matches) {
    const bracketedName = match[1]?.trim();
    const rawArguments = match[2]?.trim();
    if (!bracketedName || !rawArguments) {
      continue;
    }

    const toolName = normalizeBracketedToolName(bracketedName);
    if (!toolNames.has(toolName)) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawArguments) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        continue;
      }

      return {
        tool: toolName,
        arguments: parsed as Record<string, unknown>,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function extractActionFromAssistantMessage(
  message: AssistantMessage,
  tools: Tool[]
): TextToolAction | null {
  const toolNames = new Set(tools.map((tool) => tool.name));
  const visibleBlocks = message.content.flatMap((block) => {
    if (block.type === 'text') {
      return [block.text];
    }

    if (block.type === 'thinking') {
      return [block.thinking];
    }

    return [];
  });

  for (const blockText of [...visibleBlocks].reverse()) {
    const bracketedAction = extractBracketedToolAction(blockText, toolNames);
    if (bracketedAction) {
      return bracketedAction;
    }
  }

  const candidates = visibleBlocks
    .flatMap((blockText) => extractCandidatePayloads(blockText))
    .reverse();

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const jsonCandidate = candidate.trim();
    try {
      const parsed = JSON.parse(jsonCandidate) as {
        name?: unknown;
        arguments?: unknown;
      };

      if (
        typeof parsed.name !== 'string' ||
        !toolNames.has(parsed.name) ||
        (parsed.arguments !== undefined &&
          (typeof parsed.arguments !== 'object' ||
            parsed.arguments === null ||
            Array.isArray(parsed.arguments)))
      ) {
        continue;
      }

      return {
        tool: parsed.name,
        arguments:
          (parsed.arguments as Record<string, unknown> | undefined) ?? {},
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildToolCallMessage(params: {
  source: AssistantMessage;
  action: TextToolAction;
}): AssistantMessage {
  const toolCall: ToolCall = {
    type: 'toolCall',
    id: `${params.action.tool}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: params.action.tool,
    arguments: params.action.arguments,
  };

  return {
    ...params.source,
    content: [toolCall],
    stopReason: 'toolUse',
  };
}

function streamMessage(
  stream: LocalAssistantMessageEventStream,
  message: AssistantMessage
): void {
  const partial: AssistantMessage = {
    ...message,
    content: [],
  };

  stream.push({
    type: 'start',
    partial: {
      ...partial,
      content: [...partial.content],
    },
  });

  message.content.forEach((block, index) => {
    if (block.type === 'thinking') {
      const partialBlock: ThinkingContent = {
        type: 'thinking',
        thinking: '',
      };
      partial.content = [...partial.content, partialBlock];
      stream.push({
        type: 'thinking_start',
        contentIndex: index,
        partial: {
          ...partial,
          content: [...partial.content],
        },
      });

      partialBlock.thinking = block.thinking;
      if (block.thinking) {
        stream.push({
          type: 'thinking_delta',
          contentIndex: index,
          delta: block.thinking,
          partial: {
            ...partial,
            content: [...partial.content],
          },
        });
      }

      stream.push({
        type: 'thinking_end',
        contentIndex: index,
        content: block.thinking,
        partial: {
          ...partial,
          content: [...partial.content],
        },
      });
      return;
    }

    if (block.type === 'text') {
      const partialBlock: TextContent = {
        type: 'text',
        text: '',
      };
      partial.content = [...partial.content, partialBlock];
      stream.push({
        type: 'text_start',
        contentIndex: index,
        partial: {
          ...partial,
          content: [...partial.content],
        },
      });

      partialBlock.text = block.text;
      if (block.text) {
        stream.push({
          type: 'text_delta',
          contentIndex: index,
          delta: block.text,
          partial: {
            ...partial,
            content: [...partial.content],
          },
        });
      }

      stream.push({
        type: 'text_end',
        contentIndex: index,
        content: block.text,
        partial: {
          ...partial,
          content: [...partial.content],
        },
      });
      return;
    }

    const partialToolCall: ToolCall = {
      type: 'toolCall',
      id: block.id,
      name: block.name,
      arguments: {},
    };
    partial.content = [...partial.content, partialToolCall];
    stream.push({
      type: 'toolcall_start',
      contentIndex: index,
      partial: {
        ...partial,
        content: [...partial.content],
      },
    });

    const argumentsJson = JSON.stringify(block.arguments);
    if (argumentsJson) {
      stream.push({
        type: 'toolcall_delta',
        contentIndex: index,
        delta: argumentsJson,
        partial: {
          ...partial,
          content: [...partial.content],
        },
      });
    }

    partialToolCall.arguments = block.arguments;
    stream.push({
      type: 'toolcall_end',
      contentIndex: index,
      toolCall: block,
      partial: {
        ...partial,
        content: [...partial.content],
      },
    });
  });

  if (message.stopReason === 'error' || message.stopReason === 'aborted') {
    stream.push({
      type: 'error',
      reason: message.stopReason,
      error: message,
    });
    stream.end(message);
    return;
  }

  stream.push({
    type: 'done',
    reason: message.stopReason === 'toolUse' ? 'toolUse' : message.stopReason,
    message,
  });
  stream.end(message);
}

function stripToolPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const nextPayload = {
    ...(payload as Record<string, unknown>),
  };

  delete nextPayload.tools;
  delete nextPayload.tool_choice;
  delete nextPayload.parallel_tool_calls;

  return nextPayload;
}

function createClient(params: {
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}) {
  return new OpenAI({
    apiKey: params.apiKey ?? 'lmstudio',
    baseURL: params.baseUrl,
    dangerouslyAllowBrowser: true,
    defaultHeaders: params.headers,
  });
}

function getVisibleAssistantText(message: AssistantMessage): string {
  return message.content
    .flatMap((block) => {
      if (block.type === 'text') {
        return [block.text];
      }

      if (block.type === 'thinking') {
        return [block.thinking];
      }

      return [];
    })
    .join('\n')
    .trim();
}

function needsRepairForInvalidToolResponse(params: {
  message: AssistantMessage;
  action: TextToolAction | null;
}): boolean {
  if (params.action) {
    return false;
  }

  const visibleText = getVisibleAssistantText(params.message);
  if (!visibleText) {
    return true;
  }

  if (visibleText.includes('[TOOL_REQUEST]')) {
    return true;
  }

  if (
    /\[(?:[A-Z][A-Z0-9_]*)\][\s\S]*?(?:\[END_[A-Z][A-Z0-9_]*\])?/g.test(
      visibleText
    )
  ) {
    return true;
  }

  return params.message.stopReason === 'length';
}

function buildRepairPrompt(message: AssistantMessage): string {
  const visibleText = getVisibleAssistantText(message);

  if (!visibleText) {
    return [
      'Your previous response was empty.',
      'Respond again with exactly one complete tool request and no extra text.',
      'Use this exact format:',
      '[TOOL_REQUEST]{"name":"tool_name","arguments":{}}[END_TOOL_REQUEST]',
    ].join(' ');
  }

  if (visibleText.includes('[TOOL_REQUEST]')) {
    return [
      'Your previous response contained an incomplete tool request.',
      'Repeat the entire tool request from scratch.',
      'Respond with exactly one complete tool request and no extra text.',
      'Use this exact format:',
      '[TOOL_REQUEST]{"name":"tool_name","arguments":{}}[END_TOOL_REQUEST]',
    ].join(' ');
  }

  if (/\[(?:[A-Z][A-Z0-9_]*)\]/g.test(visibleText)) {
    return [
      'Your previous response used an alternate bracketed tool wrapper.',
      'Repeat the same intended tool call using the exact harness format and no extra text.',
      'Use this exact format:',
      '[TOOL_REQUEST]{"name":"tool_name","arguments":{}}[END_TOOL_REQUEST]',
    ].join(' ');
  }

  return [
    'Your previous response was invalid for this tool protocol.',
    'If you need a tool, respond with exactly one complete tool request and no extra text.',
    'Use this exact format:',
    '[TOOL_REQUEST]{"name":"tool_name","arguments":{}}[END_TOOL_REQUEST]',
  ].join(' ');
}

function parseUsage(
  usage:
    | {
        prompt_tokens?: number | null;
        completion_tokens?: number | null;
        total_tokens?: number | null;
      }
    | null
    | undefined
): AssistantMessage['usage'] {
  const input = usage?.prompt_tokens ?? 0;
  const output = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? input + output;

  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

function buildPayload(params: {
  modelId: string;
  context: Context;
  options?: {
    maxTokens?: number;
    temperature?: number;
    onPayload?: (
      payload: unknown,
      model: unknown
    ) => Promise<unknown> | unknown;
  };
  model: {
    maxTokens?: number;
    compat?: {
      maxTokensField?: 'max_tokens' | 'max_completion_tokens';
    };
  };
}) {
  const payload: Record<string, unknown> = {
    model: params.modelId,
    messages: toOpenAIMessages(params.context),
    stream: false,
  };

  const maxTokens =
    params.options?.maxTokens ??
    params.model.maxTokens ??
    DEFAULT_LMSTUDIO_MAX_TOKENS;

  if (maxTokens) {
    if (params.model.compat?.maxTokensField === 'max_completion_tokens') {
      payload.max_completion_tokens = maxTokens;
    } else {
      payload.max_tokens = maxTokens;
    }
  }

  if (params.options?.temperature !== undefined) {
    payload.temperature = params.options.temperature;
  } else {
    payload.temperature = DEFAULT_LMSTUDIO_TEMPERATURE;
  }

  return payload;
}

function contentToAssistantBlocks(params: {
  content: string | null | undefined;
  reasoning: string | null | undefined;
}): AssistantMessage['content'] {
  const blocks: AssistantMessage['content'] = [];

  if (params.reasoning?.trim()) {
    blocks.push({
      type: 'thinking',
      thinking: params.reasoning,
    });
  }

  if (params.content?.trim()) {
    blocks.push({
      type: 'text',
      text: params.content,
    });
  }

  return blocks;
}

async function completeWithLmStudio(params: {
  model: {
    api: string;
    provider: string;
    id: string;
    maxTokens?: number;
    baseUrl?: string;
    headers?: Record<string, string>;
    compat?: {
      maxTokensField?: 'max_tokens' | 'max_completion_tokens';
    };
  };
  context: Context;
  options?: {
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    onPayload?: (
      payload: unknown,
      model: unknown
    ) => Promise<unknown> | unknown;
  };
}): Promise<AssistantMessage> {
  const client = createClient({
    baseUrl: params.model.baseUrl,
    apiKey: params.options?.apiKey,
    headers: {
      ...(params.model.headers ?? {}),
      ...(params.options?.headers ?? {}),
    },
  });

  let payload = buildPayload({
    modelId: params.model.id,
    context: params.context,
    options: params.options,
    model: params.model,
  });

  const strippedPayload = stripToolPayload(payload);
  const nextPayload = params.options?.onPayload
    ? await params.options.onPayload(strippedPayload, params.model)
    : strippedPayload;
  if (
    nextPayload &&
    typeof nextPayload === 'object' &&
    !Array.isArray(nextPayload)
  ) {
    payload = nextPayload as Record<string, unknown>;
  }

  const response = await client.chat.completions.create(payload as never, {
    signal: params.options?.signal,
  });
  const choice = response.choices?.[0];
  const message = choice?.message;
  const content =
    typeof message?.content === 'string'
      ? message.content
      : Array.isArray(message?.content)
        ? (message.content as Array<Record<string, unknown>>)
            .flatMap((part) =>
              typeof part === 'object' &&
              part &&
              'type' in part &&
              part.type === 'text' &&
              'text' in part &&
              typeof part.text === 'string'
                ? [part.text]
                : []
            )
            .join('\n')
        : '';
  const reasoning =
    typeof (message as { reasoning_content?: unknown } | undefined)
      ?.reasoning_content === 'string'
      ? ((message as { reasoning_content?: string }).reasoning_content ?? '')
      : typeof (message as { reasoning?: unknown } | undefined)?.reasoning ===
          'string'
        ? ((message as { reasoning?: string }).reasoning ?? '')
        : '';

  return {
    role: 'assistant',
    content: contentToAssistantBlocks({
      content,
      reasoning,
    }),
    api: params.model.api,
    provider: params.model.provider,
    model: params.model.id,
    responseId: response.id,
    usage: parseUsage(response.usage),
    stopReason:
      choice?.finish_reason === 'length'
        ? 'length'
        : choice?.finish_reason === 'content_filter'
          ? 'error'
          : 'stop',
    errorMessage:
      choice?.finish_reason === 'content_filter'
        ? 'LM Studio content filter stop'
        : undefined,
    timestamp: Date.now(),
  };
}

export function isLmStudioTextActionTransport(params: {
  provider: string;
  baseUrl?: string | null;
}): boolean {
  return params.provider === 'lmstudio' && Boolean(params.baseUrl);
}

export function createLmStudioTextActionStreamFn(): StreamFn {
  return async (model, context, options) => {
    const outer = new LocalAssistantMessageEventStream();

    queueMicrotask(async () => {
      try {
        const plainContext = buildPlainTextContext(context);
        let workingContext = plainContext;
        let innerMessage: AssistantMessage | null = null;
        let action: TextToolAction | null = null;

        for (
          let repairAttempt = 0;
          repairAttempt <= MAX_INVALID_RESPONSE_REPAIR_ATTEMPTS;
          repairAttempt += 1
        ) {
          innerMessage = await completeWithLmStudio({
            model,
            context: workingContext,
            options: {
              ...options,
              onPayload: async (payload, _currentModel) => {
                const strippedPayload = stripToolPayload(payload);
                return options?.onPayload
                  ? options.onPayload(strippedPayload, model)
                  : strippedPayload;
              },
            },
          });
          action = extractActionFromAssistantMessage(
            innerMessage,
            context.tools ?? []
          );

          if (
            !needsRepairForInvalidToolResponse({
              message: innerMessage,
              action,
            }) ||
            repairAttempt === MAX_INVALID_RESPONSE_REPAIR_ATTEMPTS
          ) {
            break;
          }

          workingContext = {
            ...workingContext,
            messages: [
              ...workingContext.messages,
              innerMessage,
              {
                role: 'user',
                content: buildRepairPrompt(innerMessage),
                timestamp: Date.now(),
              },
            ],
          };
        }

        if (!innerMessage) {
          throw new Error('LM Studio returned no assistant message');
        }

        const nextMessage = action
          ? buildToolCallMessage({
              source: innerMessage,
              action,
            })
          : innerMessage;

        streamMessage(outer, nextMessage);
      } catch (error) {
        const errorMessage: AssistantMessage = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text:
                error instanceof Error
                  ? error.message
                  : 'LM Studio text-action transport failed',
            },
          ],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };

        outer.push({
          type: 'error',
          reason: 'error',
          error: errorMessage,
        });
        outer.end(errorMessage);
      }
    });

    return outer as unknown as ReturnType<StreamFn>;
  };
}
