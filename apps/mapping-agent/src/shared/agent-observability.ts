import type { Logger } from 'pino';
import type { PiAgentObservedEvent } from '../runtime/pi-runner';

const FIRST_EVENT_HEARTBEAT_MS = 15_000;
const PREVIEW_MAX_LENGTH = 2_000;

function previewValue(value: unknown, maxLength = PREVIEW_MAX_LENGTH): string {
  const text =
    typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

interface AgentSessionLoggerParams {
  logger: Logger;
  daoSlug: string;
  entityName: 'proposal' | 'delegate';
  entityId: string;
}

export interface AgentSessionLogger {
  startedAtMs: number;
  onEvent: (event: PiAgentObservedEvent) => void;
  stop: () => void;
}

export function createAgentSessionLogger(
  params: AgentSessionLoggerParams
): AgentSessionLogger {
  const startedAtMs = Date.now();
  let sawSessionEvent = false;
  const entityIdKey =
    params.entityName === 'proposal' ? 'proposalId' : 'delegateId';
  const entityTitle =
    params.entityName === 'proposal' ? 'Proposal' : 'Delegate';
  const base = {
    daoSlug: params.daoSlug,
    [entityIdKey]: params.entityId,
  };

  params.logger.info(base, `Starting ${params.entityName} agent session`);

  const waitingInterval = setInterval(() => {
    if (sawSessionEvent) {
      return;
    }

    params.logger.info(
      {
        ...base,
        waitedMs: Date.now() - startedAtMs,
      },
      `${entityTitle} agent session is still waiting for the first assistant or tool event`
    );
  }, FIRST_EVENT_HEARTBEAT_MS);

  return {
    startedAtMs,
    onEvent(event) {
      sawSessionEvent = true;

      const eventBase = {
        ...base,
        piEvent: event.type,
      };

      switch (event.type) {
        case 'assistant_text_delta':
          params.logger.info(
            {
              ...eventBase,
              delta: event.delta,
            },
            `${entityTitle} agent streamed assistant text`
          );
          return;
        case 'assistant_message_end':
          params.logger.info(
            {
              ...eventBase,
              text: event.text,
            },
            `${entityTitle} agent completed assistant message`
          );
          return;
        case 'tool_execution_start':
          params.logger.info(
            {
              ...eventBase,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
            },
            `${entityTitle} agent started tool execution`
          );
          return;
        case 'tool_execution_update':
          params.logger.info(
            {
              ...eventBase,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              partialResult: previewValue(event.partialResult),
            },
            `${entityTitle} agent streamed tool execution output`
          );
          return;
        case 'tool_execution_end':
          params.logger.info(
            {
              ...eventBase,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              isError: event.isError,
              result: previewValue(event.result),
            },
            `${entityTitle} agent finished tool execution`
          );
          return;
        case 'turn_end':
          params.logger.info(
            {
              ...eventBase,
              turnCount: event.turnCount,
            },
            `${entityTitle} agent finished turn`
          );
      }
    },
    stop() {
      clearInterval(waitingInterval);
    },
  };
}
