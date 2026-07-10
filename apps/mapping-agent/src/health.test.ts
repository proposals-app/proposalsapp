import { describe, expect, it } from 'vitest';
import {
  createTaskHealthState,
  evaluateServiceHealth,
  recordTaskFailure,
  recordTaskSuccess,
} from './health';

describe('mapping agent health', () => {
  const now = new Date('2026-07-10T12:00:00.000Z');

  it('starts unhealthy until every required worker has attempted a cycle', () => {
    const proposal = createTaskHealthState();
    const delegate = createTaskHealthState();
    recordTaskSuccess(proposal, now);

    expect(evaluateServiceHealth([proposal, delegate])).toBe('starting');
  });

  it('reports failure without erasing the previous success time', () => {
    const state = createTaskHealthState();
    recordTaskSuccess(state, now);
    recordTaskFailure(
      state,
      new Date('2026-07-10T12:01:00.000Z'),
      new Error('database unavailable')
    );

    expect(evaluateServiceHealth([state])).toBe('degraded');
    expect(state.lastSuccessAt).toBe('2026-07-10T12:00:00.000Z');
    expect(state.lastError).toBe('database unavailable');
  });

  it('recovers after every worker succeeds', () => {
    const proposal = createTaskHealthState();
    const delegate = createTaskHealthState();
    recordTaskFailure(proposal, now, 'failed');
    recordTaskSuccess(proposal, now);
    recordTaskSuccess(delegate, now);

    expect(evaluateServiceHealth([proposal, delegate])).toBe('healthy');
  });
});
