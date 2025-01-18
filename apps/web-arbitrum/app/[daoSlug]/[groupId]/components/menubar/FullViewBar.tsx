"use client";

import { useEffect, useRef } from "react";
import { ViewEnum, VotesFilterEnum } from "@/app/searchParams";
import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import { ArrowDown, ArrowUp, Check, ChevronsUpDown } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";
import { voteFilters } from "./MenuBar";

const useDebouncedScroll = (callback: () => void, delay: number) => {
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      timeoutId.current = setTimeout(callback, delay);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, [callback, delay]);
};

export const FullViewBar = () => {
  const [comments, setComments] = useQueryState(
    "comments",
    parseAsBoolean.withDefault(true).withOptions({ shallow: false }),
  );

  const [votesFilter, setVotesFilter] = useQueryState(
    "votes",
    parseAsStringEnum<VotesFilterEnum>(Object.values(VotesFilterEnum))
      .withDefault(VotesFilterEnum.FIVE_MILLION)
      .withOptions({ shallow: false }),
  );

  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum))
      .withDefault(ViewEnum.FULL)
      .withOptions({ shallow: false }),
  );

  const [expanded, setExpanded] = useQueryState(
    "expanded",
    parseAsBoolean.withDefault(false).withOptions({ shallow: false }),
  );

  const fullViewBarRef = useRef<HTMLDivElement | null>(null);

  useDebouncedScroll(() => {
    if (!fullViewBarRef.current) return;

    const rect = fullViewBarRef.current.getBoundingClientRect();

    if (rect.top < 80 && view !== ViewEnum.COMMENTS) {
      setView(ViewEnum.COMMENTS);
    } else if (
      rect.top >= 80 &&
      rect.bottom <= window.innerHeight &&
      view !== ViewEnum.FULL
    ) {
      setView(ViewEnum.FULL);
    } else if (rect.top > window.innerHeight && view !== ViewEnum.BODY) {
      setView(ViewEnum.BODY);
    }
  }, 10); // 100ms debounce

  return (
    <div
      ref={fullViewBarRef}
      className={`mt-4 w-full self-center px-2 transition-opacity duration-300 ${
        view === ViewEnum.FULL ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors">
        <div className="flex w-full justify-between">
          {expanded ? (
            <div
              className="flex cursor-pointer items-center gap-4 hover:underline"
              onClick={() => {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <ArrowUp className="h-8 w-8 rounded-full border p-1 hover:bg-gray-100" />
              <div>Collapse Proposal</div>
            </div>
          ) : (
            <div
              className="flex cursor-pointer items-center gap-4 hover:underline"
              onClick={() => {
                setView(ViewEnum.BODY);
                setExpanded(true);
              }}
            >
              <ArrowDown className="h-8 w-8 rounded-full border p-1 hover:bg-gray-100" />
              <div>Read Full Proposal</div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Switch.Root
                id="comments"
                checked={comments}
                onCheckedChange={(checked) => setComments(checked)}
                className="relative h-6 w-11 rounded-full bg-gray-300 data-[state=checked]:bg-blue-500"
              >
                <Switch.Thumb className="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-100 will-change-transform data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <label htmlFor="comments" className="cursor-pointer">
                Show comments
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    className="flex h-8 w-[200px] items-center justify-between rounded-full border bg-white px-4 text-sm hover:bg-gray-100"
                    aria-expanded={false}
                  >
                    {voteFilters.find((filter) => filter.value === votesFilter)
                      ?.label || "Select vote filter..."}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </Popover.Trigger>
                <Popover.Content className="w-[200px] rounded-md border bg-white p-1 shadow-lg">
                  <div className="space-y-1">
                    {voteFilters.map((filter) => (
                      <button
                        key={filter.value}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-100"
                        onClick={() => {
                          setVotesFilter(
                            filter.value === votesFilter
                              ? VotesFilterEnum.ALL
                              : (filter.value as VotesFilterEnum),
                          );
                        }}
                      >
                        {filter.label}
                        {votesFilter === filter.value && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Root>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
