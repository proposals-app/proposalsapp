import { describe, expect, it } from 'vitest';
import { getProposalStateImageDimensions } from './proposal-state-image';

describe('getProposalStateImageDimensions', () => {
  it('uses the existing default dimensions', () => {
    expect(getProposalStateImageDimensions(new URLSearchParams())).toEqual({
      width: 1200,
      height: 60,
    });
  });

  it('keeps the compact two-row layout', () => {
    expect(
      getProposalStateImageDimensions(
        new URLSearchParams({ width: '500', height: '80' })
      )
    ).toEqual({ width: 500, height: 160 });
  });

  it('bounds hostile or accidental dimensions', () => {
    expect(
      getProposalStateImageDimensions(
        new URLSearchParams({ width: '999999999', height: '-20' })
      )
    ).toEqual({ width: 2400, height: 40 });
  });
});
