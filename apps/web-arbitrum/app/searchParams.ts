import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
} from "nuqs/server";

export enum ViewEnum {
  BODY = "body",
  FULL = "full",
  COMMENTS = "comments",
}

export enum VotesFilterEnum {
  NONE = "none",
  FIFTY_THOUSAND = "50k",
  FIVE_HUNDRED_THOUSAND = "500k",
  FIVE_MILLION = "5m",
}

export const searchParamsCache = createSearchParamsCache({
  version: parseAsInteger,
  view: parseAsStringEnum<ViewEnum>(Object.values(ViewEnum)).withDefault(
    ViewEnum.FULL,
  ),
  expanded: parseAsBoolean.withDefault(false),
  comments: parseAsBoolean.withDefault(true),
  votes: parseAsStringEnum<VotesFilterEnum>(
    Object.values(VotesFilterEnum),
  ).withDefault(VotesFilterEnum.FIVE_MILLION),
});
