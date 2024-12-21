"use client";
import { ViewType } from "@/app/searchParams";
import { ArrowDown, ArrowUp } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";

export const MenuBar = () => {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<ViewType>(Object.values(ViewType))
      .withOptions({
        shallow: false,
      })
      .withDefault(ViewType.FULL),
  );

  const [expanded, setExpanded] = useQueryState(
    "expanded",
    parseAsBoolean.withDefault(false),
  );

  return (
    <div
      className={`max-w-[50%] self-center ${
        view === ViewType.BODY
          ? "fixed bottom-0 z-50 flex transform justify-center px-4 pb-4 transition-all duration-300 ease-in-out"
          : view === ViewType.COMMENTS
            ? "fixed top-0 z-50 flex transform justify-center px-4 pt-24 transition-all duration-300 ease-in-out"
            : "mt-4"
      } w-full`}
    >
      <button
        onClick={() => {
          if (view == ViewType.FULL && !expanded) {
            setView(ViewType.BODY);
            setExpanded(true);
          }
          if (view == ViewType.FULL && expanded) {
            setView(ViewType.FULL);
            setExpanded(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          if (view == ViewType.BODY && expanded) {
            setView(ViewType.FULL);
            setExpanded(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          if (view == ViewType.COMMENTS) {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setExpanded(true);
            setView(ViewType.BODY);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50"
        aria-label={
          view == ViewType.BODY
            ? "Expand proposal content"
            : "Collapse proposal content"
        }
      >
        {view == ViewType.FULL && !expanded && (
          <>
            <ArrowDown className="rounded-full border p-1" />
            <div className="px-2">Read Full Proposal</div>
          </>
        )}
        {view == ViewType.BODY && (
          <>
            <ArrowUp className="rounded-full border p-1" />
            <div className="flex flex-row items-center gap-2">
              <div className="px-2">Comments and Votes</div>
              <ArrowDown className="rounded-full border p-1" />
            </div>
          </>
        )}
        {view == ViewType.COMMENTS && (
          <>
            <div className="flex flex-row items-center gap-2">
              <ArrowUp className="rounded-full border p-1" />
              <div className="px-2">Read Full Proposal</div>
            </div>
            <div className="flex gap-2">
              <div>filter</div>
              <div>filter</div>
            </div>
          </>
        )}
      </button>
    </div>
  );
};
