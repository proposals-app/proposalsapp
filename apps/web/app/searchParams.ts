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
  votes: parseAsStringEnum<VotesFilterEnum>(
    Object.values(VotesFilterEnum)
  ).withDefault(VotesFilterEnum.FIFTY_THOUSAND),
  page: parseAsInteger,
});
