import { describe, expect, it } from 'vitest';
import { appendAll, chunkArray, DB_IN_FILTER_CHUNK_SIZE } from './arrays';

describe('chunkArray', () => {
  it('keeps database parameter batches below the configured limit', () => {
    const values = Array.from(
      { length: DB_IN_FILTER_CHUNK_SIZE * 2 + 17 },
      (_, index) => index
    );

    const chunks = chunkArray(values);

    expect(chunks.map((chunk) => chunk.length)).toEqual([
      DB_IN_FILTER_CHUNK_SIZE,
      DB_IN_FILTER_CHUNK_SIZE,
      17,
    ]);
    expect(chunks.flat()).toEqual(values);
  });

  it('rejects invalid chunk sizes', () => {
    expect(() => chunkArray([1], 0)).toThrow(RangeError);
    expect(() => chunkArray([1], 1.5)).toThrow(RangeError);
  });
});

describe('appendAll', () => {
  it('appends arrays too large for spread syntax', () => {
    const target = [0];
    const values = Array.from({ length: 150_000 }, (_, index) => index + 1);

    appendAll(target, values);

    expect(target).toHaveLength(150_001);
    expect(target.at(-1)).toBe(150_000);
  });
});
