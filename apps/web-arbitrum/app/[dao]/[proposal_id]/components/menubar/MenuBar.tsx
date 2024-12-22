"use client";
import { ViewType } from "@/app/searchParams";
import { ArrowDown, ArrowUp } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";
import { FullViewBar } from "./FullViewBar";
import { BodyViewBar } from "./BodyViewBar";
import { CommentsViewBar } from "./CommentsViewBar";

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
      <button className="flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50">
        {view == ViewType.FULL && !expanded && (
          <FullViewBar
            onClick={() => {
              setView(ViewType.BODY);
              setExpanded(true);
            }}
          />
        )}
        {view == ViewType.BODY && (
          <BodyViewBar
            onClick={() => {
              if (expanded) {
                setView(ViewType.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        )}
        {view == ViewType.COMMENTS && (
          <CommentsViewBar
            onClick={() => {
              setView(ViewType.BODY);
              setExpanded(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </button>
    </div>
  );
};
