export interface ResendSendResult {
  data: { id: string } | null;
  error: { message?: string; name?: string } | null;
}

export function requireResendDelivery(result: ResendSendResult): string {
  if (result.error) {
    throw new Error(result.error.message || 'Resend rejected the email.', {
      cause: result.error,
    });
  }
  if (!result.data?.id) {
    throw new Error('Resend returned neither a delivery ID nor an error.');
  }

  return result.data.id;
}

// Resend rate-limits API requests per team (10/s by default, shared with the
// web app's sign-in emails). A cycle fans out every (item, recipient) pair at
// once, so without spacing a single new proposal fires one request per
// subscriber at the same moment; the overflow fails with 429 and only goes
// out on later cycles, minutes late, with the cycle reported as failed.
export const DEFAULT_RESEND_MAX_SENDS_PER_SECOND = 4;

export function parseMaxSendsPerSecond(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_RESEND_MAX_SENDS_PER_SECOND;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RESEND_MAX_SENDS_PER_SECOND;
}

/**
 * Returns a function that resolves when the caller may start its next send,
 * spacing starts at least `1000 / maxPerSecond` ms apart. Slots are reserved
 * synchronously, so concurrent callers are queued in call order.
 */
export function createSendThrottle(
  maxPerSecond: number,
  options: {
    now?: () => number;
    wait?: (ms: number) => Promise<void>;
  } = {}
): () => Promise<void> {
  const intervalMs = 1000 / maxPerSecond;
  const now = options.now ?? Date.now;
  const wait =
    options.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let nextSlotMs = 0;

  return async () => {
    const current = now();
    const slot = Math.max(current, nextSlotMs);
    nextSlotMs = slot + intervalMs;
    if (slot > current) {
      await wait(slot - current);
    }
  };
}
