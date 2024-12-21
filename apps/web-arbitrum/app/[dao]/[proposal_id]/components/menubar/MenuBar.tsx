"use client";
import { ViewType } from "@/app/searchParams";
import { ArrowDown, ArrowUp } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";

export const MenuBar = () => {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<ViewType>(Object.values(ViewType)).withDefault(
      ViewType.FULL,
    ),
  );

  const [expanded, setExpanded] = useQueryState(
    "expanded",
    parseAsBoolean.withDefault(false),
  );

  return (
    <div
      className={`w-full self-center px-2 md:max-w-[50%] ${
        view === ViewType.BODY
          ? "fixed bottom-0 z-50 flex transform justify-center px-4 pb-4 transition-all duration-300 ease-in-out"
          : view === ViewType.COMMENTS
            ? "fixed top-0 z-50 flex transform justify-center px-4 pt-24 transition-all duration-300 ease-in-out"
            : "mt-4"
      }`}
    >
      <button
        onClick={() => {
          if (view == ViewType.FULL && !expanded) {
            setView(ViewType.BODY);
            setExpanded(true);
          }
          if (view == ViewType.FULL && expanded) {
            setExpanded(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          if (view == ViewType.BODY && expanded) {
            setView(ViewType.FULL);
            setExpanded(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          if (view == ViewType.COMMENTS) {
            setView(ViewType.BODY);
            setExpanded(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50"
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
