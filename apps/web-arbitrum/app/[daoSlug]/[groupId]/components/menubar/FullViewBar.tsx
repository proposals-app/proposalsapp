"use client";

import { useEffect, useRef } from "react";
import { ViewEnum, VotesFilterEnum } from "@/app/searchParams";
import { cn } from "@/shadcn/lib/utils";
import { Button } from "@/shadcn/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import { Label } from "@/shadcn/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Switch } from "@/shadcn/ui/switch";
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
      <div className="flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50">
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
              <ArrowUp className="h-8 w-8 rounded-full border p-1" />
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
              <ArrowDown className="h-8 w-8 rounded-full border p-1" />
              <div>Read Full Proposal</div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="comments"
                checked={comments}
                onCheckedChange={(checked) => setComments(checked)}
              />
              <Label htmlFor="comments">Show comments</Label>
            </div>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={false}
                    className={cn(`h-8 w-[200px] justify-between rounded-full`)}
                  >
                    {voteFilters.find((filter) => filter.value === votesFilter)
                      ?.label || "Select vote filter..."}
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {voteFilters.map((filter) => (
                          <CommandItem
                            key={filter.value}
                            value={filter.value}
                            onSelect={(currentValue) => {
                              setVotesFilter(
                                currentValue === votesFilter
                                  ? VotesFilterEnum.ALL
                                  : (currentValue as VotesFilterEnum),
                              );
                            }}
                          >
                            {filter.label}
                            <Check
                              className={`ml-auto ${
                                votesFilter === filter.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
