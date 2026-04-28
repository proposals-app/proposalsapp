import { describe, expect, it } from 'vitest';
import { toPublicServerActionError } from './public-error-message';

describe('toPublicServerActionError', () => {
  it('preserves explicit authentication errors', () => {
    expect(
      toPublicServerActionError(new Error('Authentication required'))
    ).toBe('Authentication required');
  });

  it('hides low-level internal failures', () => {
    expect(
      toPublicServerActionError(
        new Error('duplicate key value violates unique constraint "foo_bar"')
      )
    ).toBe('Something went wrong. Please try again.');
  });

  it('hides non-error throw values', () => {
    expect(toPublicServerActionError('boom')).toBe(
      'Something went wrong. Please try again.'
    );
  });
});
