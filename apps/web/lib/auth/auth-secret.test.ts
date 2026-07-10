import { describe, expect, it } from 'vitest';
import { getAuthSecret } from './auth-secret';

describe('getAuthSecret', () => {
  it('returns a configured runtime secret', () => {
    const secret = 'runtime-secret-that-is-at-least-32-characters';
    expect(getAuthSecret({ BETTER_AUTH_SECRET: secret })).toBe(secret);
  });

  it('rejects a short runtime secret', () => {
    expect(() => getAuthSecret({ BETTER_AUTH_SECRET: 'too-short' })).toThrow(
      'BETTER_AUTH_SECRET must be at least 32 characters long.'
    );
  });

  it('allows an isolated build-only secret during production builds', () => {
    expect(getAuthSecret({ NEXT_PHASE: 'phase-production-build' })).toBe(
      'build-only-secret-never-used-at-runtime'
    );
  });

  it('fails closed when the runtime secret is missing', () => {
    expect(() => getAuthSecret({})).toThrow(
      'BETTER_AUTH_SECRET environment variable is required.'
    );
  });
});
