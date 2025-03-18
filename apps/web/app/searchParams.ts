import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
} from 'nuqs/server';

export enum FromFilterEnum {
  ALL = 'all',
  FIFTY_THOUSAND = '50k',
  FIVE_HUNDRED_THOUSAND = '500k',
  FIVE_MILLION = '5m',
  AUTHOR = 'author',
}

export enum FeedFilterEnum {
  COMMENTS = 'comments',
  VOTES = 'votes',
  COMMENTS_AND_VOTES = 'comments_and_votes',
}

export const searchParamsCache = createSearchParamsCache({
  version: parseAsInteger,
  expanded: parseAsBoolean.withDefault(false),
  diff: parseAsBoolean.withDefault(false),
  feed: parseAsStringEnum<FeedFilterEnum>(
    Object.values(FeedFilterEnum)
  ).withDefault(FeedFilterEnum.COMMENTS_AND_VOTES),
  from: parseAsStringEnum<FromFilterEnum>(
    Object.values(FromFilterEnum)
  ).withDefault(FromFilterEnum.FIFTY_THOUSAND),
  page: parseAsInteger,
});
