import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
} from "nuqs/server";

export enum ViewType {
  BODY = "body",
  FULL = "full",
  COMMENTS = "comments",
}

export const searchParamsCache = createSearchParamsCache({
  version: parseAsInteger,
  view: parseAsStringEnum<ViewType>(Object.values(ViewType)).withDefault(
    ViewType.FULL,
  ),
  expanded: parseAsBoolean.withDefault(false),
});
