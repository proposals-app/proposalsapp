const PUBLIC_ERROR_PATTERNS = [
  /^Authentication required$/,
  /^DAO not found(?::|\s|$)/,
];

const DEFAULT_PUBLIC_ERROR = 'Something went wrong. Please try again.';

export function toPublicServerActionError(error: unknown): string {
  if (!(error instanceof Error)) {
    return DEFAULT_PUBLIC_ERROR;
  }

  if (PUBLIC_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))) {
    return error.message;
  }

  return DEFAULT_PUBLIC_ERROR;
}
