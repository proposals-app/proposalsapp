export const DB_IN_FILTER_CHUNK_SIZE = 1_000;

export function chunkArray<T>(
  values: readonly T[],
  size = DB_IN_FILTER_CHUNK_SIZE
): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError('Chunk size must be a positive integer.');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function appendAll<T>(target: T[], values: readonly T[]): void {
  for (const value of values) {
    target.push(value);
  }
}
