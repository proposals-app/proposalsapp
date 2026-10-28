export interface RetryBackoffOptions {
  initialDelayMs: number;
  maxDelayMs: number;
  now?: () => number;
}

export interface RetryBackoffFailure {
  failures: number;
  delayMs: number;
  nextAttemptAtMs: number;
}

export interface RetryBackoff {
  shouldAttempt(key: string): boolean;
  nextAttemptAtMs(key: string): number | null;
  recordFailure(key: string): RetryBackoffFailure;
  recordSuccess(key: string): void;
}

// Agent sessions that end without a decision leave the case unresolved, so the
// next pass would rerun it immediately. This spaces those retries out:
// initialDelayMs after the first failure, doubling up to maxDelayMs.
export function createRetryBackoff(options: RetryBackoffOptions): RetryBackoff {
  const now = options.now ?? Date.now;
  const state = new Map<
    string,
    { failures: number; nextAttemptAtMs: number }
  >();

  return {
    shouldAttempt(key) {
      const entry = state.get(key);
      return !entry || now() >= entry.nextAttemptAtMs;
    },
    nextAttemptAtMs(key) {
      return state.get(key)?.nextAttemptAtMs ?? null;
    },
    recordFailure(key) {
      const failures = (state.get(key)?.failures ?? 0) + 1;
      const delayMs = Math.min(
        options.maxDelayMs,
        options.initialDelayMs * 2 ** (failures - 1)
      );
      const nextAttemptAtMs = now() + delayMs;
      state.set(key, { failures, nextAttemptAtMs });
      return { failures, delayMs, nextAttemptAtMs };
    },
    recordSuccess(key) {
      state.delete(key);
    },
  };
}
