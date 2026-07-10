import { describe, expect, it } from 'vitest';
import { requireResendDelivery } from './resend-delivery';

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
