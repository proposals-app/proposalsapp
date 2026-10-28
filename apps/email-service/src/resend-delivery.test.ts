import { describe, expect, it } from 'vitest';
import {
  createSendThrottle,
  DEFAULT_RESEND_MAX_SENDS_PER_SECOND,
  parseMaxSendsPerSecond,
  requireResendDelivery,
} from './resend-delivery';

describe('requireResendDelivery', () => {
  it('returns the provider delivery id on success', () => {
    expect(
      requireResendDelivery({ data: { id: 'email-1' }, error: null })
    ).toBe('email-1');
  });

  it('throws when the SDK returns an API error', () => {
    expect(() =>
      requireResendDelivery({
        data: null,
        error: { name: 'rate_limit_exceeded', message: 'Try again later' },
      })
    ).toThrow('Try again later');
  });

  it('rejects an ambiguous empty provider response', () => {
    expect(() => requireResendDelivery({ data: null, error: null })).toThrow(
      'neither a delivery ID nor an error'
    );
  });
});

describe('parseMaxSendsPerSecond', () => {
  it('defaults when unset or invalid', () => {
    expect(parseMaxSendsPerSecond(undefined)).toBe(
      DEFAULT_RESEND_MAX_SENDS_PER_SECOND
    );
    expect(parseMaxSendsPerSecond('')).toBe(
      DEFAULT_RESEND_MAX_SENDS_PER_SECOND
    );
    expect(parseMaxSendsPerSecond('0')).toBe(
      DEFAULT_RESEND_MAX_SENDS_PER_SECOND
    );
    expect(parseMaxSendsPerSecond('fast')).toBe(
      DEFAULT_RESEND_MAX_SENDS_PER_SECOND
    );
  });

  it('accepts positive overrides', () => {
    expect(parseMaxSendsPerSecond('8')).toBe(8);
    expect(parseMaxSendsPerSecond('0.5')).toBe(0.5);
  });
});

describe('createSendThrottle', () => {
  it('spaces concurrent sends evenly in call order', async () => {
    const clock = 1_000;
    const waits: number[] = [];
    const throttle = createSendThrottle(4, {
      now: () => clock,
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    await Promise.all([throttle(), throttle(), throttle(), throttle()]);

    expect(waits).toEqual([250, 500, 750]);
  });

  it('does not delay a send once the previous slot has passed', async () => {
    let clock = 1_000;
    const waits: number[] = [];
    const throttle = createSendThrottle(4, {
      now: () => clock,
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    await throttle();
    clock += 10_000;
    await throttle();

    expect(waits).toEqual([]);
  });
});
