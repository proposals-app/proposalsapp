import { describe, expect, it } from 'vitest';
import { createSessionAuditRecorder } from './session-audit';
import type { PiAgentRunResult } from '../runtime/pi-runner';

describe('createSessionAuditRecorder', () => {
  it('captures surfaced assistant messages and tool activity for a terminal run', () => {
    const recorder = createSessionAuditRecorder({
      provider: 'lmstudio',
      model: 'qwen/qwen3.5-27b',
      thinking: 'xhigh',
      startedAtMs: Date.now() - 1000,
    });

    recorder.onEvent({
      type: 'assistant_text_delta',
      delta: 'thinking...',
      text: 'thinking...',
    });
    recorder.onEvent({
      type: 'assistant_message_end',
      text: 'I found a strong candidate.',
    });
    recorder.onEvent({
      type: 'tool_execution_start',
      toolCallId: 'call-1',
      toolName: 'query_delegate_mapping_data',
      args: { sql: 'select * from current_case' },
    });
    recorder.onEvent({
      type: 'tool_execution_end',
      toolCallId: 'call-1',
      toolName: 'query_delegate_mapping_data',
      result: { ok: true, rowCount: 1 },
      isError: false,
    });
    recorder.onEvent({
      type: 'turn_end',
      turnCount: 1,
    });

    const result: PiAgentRunResult = {
      finalText: 'Done',
      toolCalls: [{ name: 'query_delegate_mapping_data', args: {} }],
      turnCount: 1,
      queryCallCount: 1,
      decisionToolCallCount: 1,
    };

    const snapshot = recorder.snapshot(result);

    expect(snapshot.sessionTrace).toEqual([
      expect.objectContaining({
        type: 'assistant_message',
        text: 'I found a strong candidate.',
      }),
      expect.objectContaining({
        type: 'tool_execution_start',
        toolCallId: 'call-1',
        toolName: 'query_delegate_mapping_data',
      }),
      expect.objectContaining({
        type: 'tool_execution_end',
        toolCallId: 'call-1',
        toolName: 'query_delegate_mapping_data',
        isError: false,
      }),
      expect.objectContaining({
        type: 'turn_end',
        turnCount: 1,
      }),
    ]);
    expect(snapshot.sessionStats).toEqual(
      expect.objectContaining({
        provider: 'lmstudio',
        model: 'qwen/qwen3.5-27b',
        thinking: 'xhigh',
        turnCount: 1,
        queryCallCount: 1,
        decisionToolCallCount: 1,
        toolCallCount: 1,
        finalText: 'Done',
      })
    );
  });
});
