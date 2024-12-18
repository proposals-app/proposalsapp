"use client";

import { ViewType } from "@/app/searchParams";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { format, formatDistanceToNow, formatISO } from "date-fns";
import { parseAsStringEnum, useQueryState } from "nuqs";

// Helper component to display the time with a tooltip
export const PostedTime = ({
  label,
  createdAt,
  border,
}: {
  label: string;
  createdAt: Date;
  border?: true;
}) => {
  const [viewType, setViewType] = useQueryState(
    "view",
    parseAsStringEnum<ViewType>(Object.values(ViewType))
      .withDefault(ViewType.TIMELINE)
      .withOptions({ shallow: false }),
  );

  const relativeTime = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  const formattedDateTime = format(
    formatISO(new Date(createdAt)),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={`flex flex-col items-center p-2 ${border ? "rounded-lg border bg-white" : ""}`}
            onClick={() => {
              viewType == ViewType.BODY
                ? setViewType(ViewType.TIMELINE)
                : setViewType(ViewType.BODY);
            }}
          >
            <span className="text-gray-600">{label}</span>
            <span className="font-bold">{relativeTime}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-40 text-center text-xs">
          <p>{formattedDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
