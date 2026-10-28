import { describe, expect, it } from 'vitest';
import { createRetryBackoff } from './retry-backoff';

const MINUTE = 60_000;

function setup() {
  let nowMs = 0;
  const backoff = createRetryBackoff({
    initialDelayMs: 30 * MINUTE,
    maxDelayMs: 24 * 60 * MINUTE,
    now: () => nowMs,
  });
  return {
    backoff,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe('createRetryBackoff', () => {
  it('allows a key that has never failed', () => {
    const { backoff } = setup();

    expect(backoff.shouldAttempt('a')).toBe(true);
    expect(backoff.nextAttemptAtMs('a')).toBeNull();
  });

  it('waits the initial delay after the first failure', () => {
    const { backoff, advance } = setup();

    expect(backoff.recordFailure('a')).toEqual({
      failures: 1,
      delayMs: 30 * MINUTE,
      nextAttemptAtMs: 30 * MINUTE,
    });
    expect(backoff.shouldAttempt('a')).toBe(false);

    advance(30 * MINUTE - 1);
    expect(backoff.shouldAttempt('a')).toBe(false);

    advance(1);
    expect(backoff.shouldAttempt('a')).toBe(true);
  });

  it('doubles the delay on each failure up to the maximum', () => {
    const { backoff } = setup();

    const delays = Array.from(
      { length: 8 },
      () => backoff.recordFailure('a').delayMs / MINUTE
    );

    expect(delays).toEqual([30, 60, 120, 240, 480, 960, 1440, 1440]);
  });

  it('tracks keys independently', () => {
    const { backoff } = setup();

    backoff.recordFailure('a');

    expect(backoff.shouldAttempt('a')).toBe(false);
    expect(backoff.shouldAttempt('b')).toBe(true);
  });

  it('forgets a key after a success', () => {
    const { backoff } = setup();

    backoff.recordFailure('a');
    backoff.recordFailure('a');
    backoff.recordSuccess('a');

    expect(backoff.shouldAttempt('a')).toBe(true);
    expect(backoff.recordFailure('a').delayMs).toBe(30 * MINUTE);
  });
});
