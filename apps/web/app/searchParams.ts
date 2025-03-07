import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
} from 'nuqs/server';

export enum VotesFilterEnum {
  ALL = 'all',
  FIFTY_THOUSAND = '50k',
  FIVE_HUNDRED_THOUSAND = '500k',
  FIVE_MILLION = '5m',
}

export const searchParamsCache = createSearchParamsCache({
  version: parseAsInteger,
  expanded: parseAsBoolean.withDefault(false),
  diff: parseAsBoolean.withDefault(false),
  comments: parseAsBoolean.withDefault(true),
  votes: parseAsStringEnum<VotesFilterEnum>(
    Object.values(VotesFilterEnum)
  ).withDefault(VotesFilterEnum.FIVE_MILLION),
  page: parseAsInteger,
});
