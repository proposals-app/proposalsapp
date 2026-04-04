import { describe, expect, it } from 'vitest';
import { extractDiscourseIdOrSlug } from './url';

describe('extractDiscourseIdOrSlug', () => {
  it('extracts id from id-only topic URLs', () => {
    expect(extractDiscourseIdOrSlug('https://example.com/t/12345')).toEqual({
      id: 12345,
      slug: null,
    });
  });

  it('extracts both slug and id from full Discourse topic URLs', () => {
    expect(
      extractDiscourseIdOrSlug(
        'https://forum.arbitrum.foundation/t/reallocate-redeemed-usdm-funds-to-step-2-budget/29335?u=entropy'
      )
    ).toEqual({
      id: 29335,
      slug: 'reallocate-redeemed-usdm-funds-to-step-2-budget',
    });
  });

  it('returns nulls for non-topic URLs', () => {
    expect(
      extractDiscourseIdOrSlug('https://example.com/some/other/path')
    ).toEqual({
      id: null,
      slug: null,
    });
  });
});
