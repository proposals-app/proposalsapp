import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsStringEnum,
} from "nuqs/server";

export enum ViewType {
  BODY = "body",
  TIMELINE = "timeline",
}

export const searchParamsCache = createSearchParamsCache({
  version: parseAsInteger,
  view: parseAsStringEnum<ViewType>(Object.values(ViewType)).withDefault(
    ViewType.TIMELINE,
  ),
});
