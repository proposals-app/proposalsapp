import { describe, expect, it } from 'vitest';
import {
  buildChangeEmailTemplateProps,
  ensureAuthEmailWasSent,
} from './email-delivery';

describe('buildChangeEmailTemplateProps', () => {
  it('avoids claiming to know the current email when only the new email is available', () => {
    expect(buildChangeEmailTemplateProps('new@example.com')).toEqual({
      newEmail: 'new@example.com',
    });
  });
});

describe('ensureAuthEmailWasSent', () => {
  it('does not throw when resend reports success', () => {
    expect(() =>
      ensureAuthEmailWasSent(
        { data: { id: 'email-1' }, error: null },
        'verification email'
      )
    ).not.toThrow();
  });

  it('throws a delivery error when resend reports a failure', () => {
    expect(() =>
      ensureAuthEmailWasSent(
        { data: null, error: new Error('provider offline') },
        'verification email'
      )
    ).toThrow('Failed to send verification email.');
  });
});
