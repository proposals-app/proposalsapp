"use client";

import { useEffect, useRef } from "react";
import { ViewEnum, VotesFilterEnum } from "@/app/searchParams";
import { cn } from "@/shadcn/lib/utils";
import { Button } from "@/shadcn/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import { Label } from "@/shadcn/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Switch } from "@/shadcn/ui/switch";
import { ArrowDown, ArrowUp, Check, ChevronsUpDown } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";
import { voteFilters } from "./MenuBar";

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

  useEffect(() => {
    if (!fullViewBarRef.current) return;

    // Track the last known scroll position
    let lastScrollY = window.scrollY;

    // Helper function to determine view based on element position
    const updateViewState = () => {
      if (!fullViewBarRef.current) return;

      const rect = fullViewBarRef.current.getBoundingClientRect();
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY;
      lastScrollY = currentScrollY;

      // Scrolling down and element is above viewport, accounting for sticky header
      if (scrollingDown && rect.top < 80 && view != ViewEnum.COMMENTS) {
        setView(ViewEnum.COMMENTS);
      }
      // Element is fully visible
      else if (
        rect.top >= 80 &&
        rect.bottom <= window.innerHeight &&
        view != ViewEnum.FULL
      ) {
        setView(ViewEnum.FULL);
      }
      // Scrolling up and element is below viewport
      else if (
        !scrollingDown &&
        rect.top > window.innerHeight &&
        view != ViewEnum.BODY
      ) {
        setView(ViewEnum.BODY);
      }
    };

    // Debounce function to limit update frequency
    let timeoutId: NodeJS.Timeout | null = null;
    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(updateViewState, 50); // 50ms debounce
    };

    // Set up Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setView(ViewEnum.FULL);
        } else {
          updateViewState();
        }
      },
      {
        threshold: [0, 1],
        rootMargin: "-80px 0px -10px 0px", // Adjusted for sticky header height
      },
    );

    // Add scroll event listener
    const handleScroll = () => {
      debouncedUpdate();
    };

    // Set up observers and listeners
    observer.observe(fullViewBarRef.current);
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Cleanup
    return () => {
      if (fullViewBarRef.current) {
        observer.unobserve(fullViewBarRef.current);
      }
      window.removeEventListener("scroll", handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [setView]);

  return (
    <div
      ref={fullViewBarRef}
      className={`mt-4 w-full self-center px-2 ${view == ViewEnum.FULL ? "" : "pointer-events-none opacity-0"}`}
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
                              className={`ml-auto ${votesFilter === filter.value ? "opacity-100" : "opacity-0"}`}
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
