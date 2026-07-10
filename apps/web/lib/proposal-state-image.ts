const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 60;
const MIN_WIDTH = 320;
const MAX_WIDTH = 2400;
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 600;

function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (!value || !/^-?\d+$/.test(value)) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) return fallback;

  return Math.min(Math.max(parsed, min), max);
}

export function getProposalStateImageDimensions(searchParams: URLSearchParams) {
  const width = boundedInteger(
    searchParams.get('width'),
    DEFAULT_WIDTH,
    MIN_WIDTH,
    MAX_WIDTH
  );
  const baseHeight = boundedInteger(
    searchParams.get('height'),
    DEFAULT_HEIGHT,
    MIN_HEIGHT,
    MAX_HEIGHT
  );
  const height = Math.min(
    width < 600 ? baseHeight * 2 : baseHeight,
    MAX_HEIGHT
  );

  return { width, height };
}
