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
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum)).withDefault(
      ViewEnum.FULL,
    ),
  );

  const [expanded, setExpanded] = useQueryState(
    "expanded",
    parseAsBoolean.withDefault(false),
  );

  return (
    <div
      className={`w-full self-center px-2 ${
        view === ViewEnum.BODY
          ? "fixed bottom-0 z-50 flex transform justify-center px-4 pb-4 transition-all duration-300 ease-in-out md:max-w-[75%]"
          : view === ViewEnum.COMMENTS
            ? "fixed top-0 z-50 flex transform justify-center px-4 pt-24 transition-all duration-300 ease-in-out md:max-w-[75%]"
            : "mt-4"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50">
        {view == ViewEnum.FULL && !expanded && (
          <FullViewBar
            onClickAction={() => {
              setView(ViewEnum.BODY);
              setExpanded(true);
            }}
          />
        )}
        {view == ViewEnum.BODY && (
          <BodyViewBar
            onClick={() => {
              if (expanded) {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        )}
        {view == ViewEnum.COMMENTS && (
          <CommentsViewBar
            onClickAction={() => {
              setView(ViewEnum.BODY);
              setExpanded(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </div>
    </div>
  );
};
