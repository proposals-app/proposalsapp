import { test, expect } from '@playwright/test';

const REQUIRED_BONEYARD_NAMES = [
  'arbitrum-summary-header',
  'uniswap-summary-header',
  'groups-header',
  'group-page',
  'results-page',
  'group-list',
  'post-item',
  'vote-item-feed',
  'results-title',
  'results-table',
  'chart',
];

test('boneyard capture route exposes the real loading surfaces', async ({
  page,
}) => {
  await page.goto('/boneyard-capture');

  await expect(page.getByRole('heading', { name: 'Boneyard Capture' })).toBeVisible();

  const names = await page.locator('[data-boneyard]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-boneyard'))
      .filter((value): value is string => Boolean(value))
  );

  expect(names.length).toBeGreaterThanOrEqual(REQUIRED_BONEYARD_NAMES.length);
  expect(new Set(names).size).toBe(names.length);

  for (const requiredName of REQUIRED_BONEYARD_NAMES) {
    expect(names).toContain(requiredName);
  }
});
