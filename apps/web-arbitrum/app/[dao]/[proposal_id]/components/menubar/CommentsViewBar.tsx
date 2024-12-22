"use client";

import { VotesFilterEnum } from "@/app/searchParams";
import { cn } from "@/shadcn/lib/utils";
import { Button } from "@/shadcn/ui/button";
import { Label } from "@/shadcn/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Switch } from "@/shadcn/ui/switch";
import { ArrowUp, Check, ChevronsUpDown } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";
import { voteFilters } from "./MenuBar";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";

export const CommentsViewBar = ({
  onClickAction,
}: {
  onClickAction: () => void;
}) => {
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

  return (
    <div className="flex w-full justify-between">
      <div className="flex flex-row items-center gap-2">
        <ArrowUp className="rounded-full border p-1" />
        <div
          className="cursor-pointer px-2 hover:underline"
          onClick={onClickAction}
        >
          Read Full Proposal
        </div>
      </div>
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
                              ? VotesFilterEnum.NONE
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
  );
};
