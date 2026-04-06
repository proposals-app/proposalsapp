import type {
  PiAgentObservedEvent,
  PiAgentRunResult,
} from '../runtime/pi-runner';

export type PersistedSessionEvent =
  | {
      type: 'assistant_message';
      recordedAt: string;
      text: string;
    }
  | {
      type: 'tool_execution_start';
      recordedAt: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: 'tool_execution_update';
      recordedAt: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      partialResult: unknown;
    }
  | {
      type: 'tool_execution_end';
      recordedAt: string;
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError: boolean;
    }
  | {
      type: 'turn_end';
      recordedAt: string;
      turnCount: number;
    };

export interface PersistedSessionStats {
  provider: string;
  model: string;
  thinking: string;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  turnCount: number;
  queryCallCount: number;
  decisionToolCallCount: number;
  toolCallCount: number;
  finalText: string;
}

export interface SessionAuditSnapshot {
  sessionTrace: PersistedSessionEvent[];
  sessionStats: PersistedSessionStats;
}

export interface SessionAuditRecorder {
  onEvent: (event: PiAgentObservedEvent) => void;
  snapshot: (result: PiAgentRunResult) => SessionAuditSnapshot;
}

export function createSessionAuditRecorder(input: {
  provider: string;
  model: string;
  thinking: string;
  startedAtMs: number;
}): SessionAuditRecorder {
  const events: PersistedSessionEvent[] = [];

  return {
    onEvent(event) {
      const recordedAt = new Date().toISOString();

      switch (event.type) {
        case 'assistant_text_delta':
          return;
        case 'assistant_message_end':
          events.push({
            type: 'assistant_message',
            recordedAt,
            text: event.text,
          });
          return;
        case 'tool_execution_start':
          events.push({
            type: 'tool_execution_start',
            recordedAt,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          });
          return;
        case 'tool_execution_update':
          events.push({
            type: 'tool_execution_update',
            recordedAt,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            partialResult: event.partialResult,
          });
          return;
        case 'tool_execution_end':
          events.push({
            type: 'tool_execution_end',
            recordedAt,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            result: event.result,
            isError: event.isError,
          });
          return;
        case 'turn_end':
          events.push({
            type: 'turn_end',
            recordedAt,
            turnCount: event.turnCount,
          });
      }
    },
    snapshot(result) {
      const endedAtMs = Date.now();

      return {
        sessionTrace: events,
        sessionStats: {
          provider: input.provider,
          model: input.model,
          thinking: input.thinking,
          startedAt: new Date(input.startedAtMs).toISOString(),
          endedAt: new Date(endedAtMs).toISOString(),
          elapsedMs: Math.max(0, endedAtMs - input.startedAtMs),
          turnCount: result.turnCount,
          queryCallCount: result.queryCallCount,
          decisionToolCallCount: result.decisionToolCallCount,
          toolCallCount: result.toolCalls.length,
          finalText: result.finalText,
        },
      };
    },
  };
}
