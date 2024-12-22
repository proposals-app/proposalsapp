"use client";
import { ViewEnum, VotesFilterEnum } from "@/app/searchParams";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";
import { FullViewBar } from "./FullViewBar";
import { BodyViewBar } from "./BodyViewBar";
import { CommentsViewBar } from "./CommentsViewBar";

export const voteFilters = [
  {
    value: VotesFilterEnum.NONE,
    label: "No Filter",
  },
  {
    value: VotesFilterEnum.FIFTY_THOUSAND,
    label: "Votes > 50k ARB",
  },
  {
    value: VotesFilterEnum.FIVE_HUNDRED_THOUSAND,
    label: "Votes > 500k ARB",
  },
  {
    value: VotesFilterEnum.FIVE_MILLION,
    label: "Votes > 5m ARB",
  },
];

export const MenuBar = () => {
  const [view] = useQueryState(
    "view",
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum)).withDefault(
      ViewEnum.FULL,
    ),
  );

  const [expanded] = useQueryState(
    "expanded",
    parseAsBoolean.withDefault(false),
  );

  return (
    <div className="w-full">
      <FullViewBar enabled={view == ViewEnum.FULL && !expanded} />
      {view == ViewEnum.BODY && <BodyViewBar />}
      {view == ViewEnum.COMMENTS && <CommentsViewBar />}
    </div>
  );
};
