const PRODUCTION_BUILD_PHASE = 'phase-production-build';
const BUILD_ONLY_SECRET = 'build-only-secret-never-used-at-runtime';

interface AuthSecretEnvironment {
  readonly [key: string]: string | undefined;
  readonly BETTER_AUTH_SECRET?: string;
  readonly NEXT_PHASE?: string;
}

export function getAuthSecret(
  environment: AuthSecretEnvironment = process.env
): string {
  const secret = environment.BETTER_AUTH_SECRET;

  if (secret) {
    if (secret.length < 32) {
      throw new Error(
        'BETTER_AUTH_SECRET must be at least 32 characters long.'
      );
    }
    return secret;
  }

  if (environment.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
    return BUILD_ONLY_SECRET;
  }

  throw new Error('BETTER_AUTH_SECRET environment variable is required.');
}
