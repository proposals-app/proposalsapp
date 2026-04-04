function splitIntoTokens(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return splitIntoTokens(value).join(' ');
}

export function tokenizeText(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return splitIntoTokens(value);
}

export function getEnsStem(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return normalizeText(value.split('.')[0] ?? '');
}

export function countTokenOverlap(
  left: string[] | string,
  right: string[] | string
): number {
  const leftTokens = new Set(Array.isArray(left) ? left : tokenizeText(left));
  const rightTokens = new Set(
    Array.isArray(right) ? right : tokenizeText(right)
  );

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}
