"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/shadcn/ui/button";
import { Calendar } from "@/shadcn/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { subDays, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";

export function DatePickerWithRange({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("from");
  const toQuery = searchParams.get("to");
  const router = useRouter();

  const [date, setDate] = useState<DateRange | undefined>({
    from: toQuery ? new Date(parseInt(toQuery) * 1000) : new Date(),
    to: fromQuery
      ? new Date(parseInt(fromQuery) * 1000)
      : subDays(new Date(), 7),
  });

  const setQuery = useCallback(
    (from: string, from_value: string, to: string, to_value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(from, from_value);
      params.set(to, to_value);

      return params.toString();
    },
    [searchParams],
  );

  // useEffect(() => {
  //   if (date && date.from && date.to && router) {
  //     router.push(
  //       "?" +
  //         setQuery(
  //           "from",
  //           (date.from.getTime() / 1000).toFixed(0).toString(),
  //           "to",
  //           (date.to.getTime() / 1000).toFixed(0).toString(),
  //         ),
  //     );
  //   }
  // }, [date, router]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
