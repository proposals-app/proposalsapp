export const DAO_DISCOURSE_CATEGORY_FILTERS: Readonly<
  Record<string, readonly number[]>
> = Object.freeze({
  arbitrum: Object.freeze([7, 8, 9]),
  uniswap: Object.freeze([5, 8, 9, 10]),
});

export const ENABLED_DAO_SLUGS = Object.freeze(
  Object.keys(DAO_DISCOURSE_CATEGORY_FILTERS)
);
