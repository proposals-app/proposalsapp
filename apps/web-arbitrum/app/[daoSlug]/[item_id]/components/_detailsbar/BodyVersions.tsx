"use client";

import { notFound } from "next/navigation";
import { Body } from "../../actions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { format, formatDistanceToNow, formatISO } from "date-fns";
import { parseAsInteger, useQueryState } from "nuqs";

interface BodyVersionProps {
  body: Body;
  version: number;
}

export default function BodyVersion({ body, version }: BodyVersionProps) {
  if (!body) {
    notFound();
  }

  const relativeTime = formatDistanceToNow(new Date(body.createdAt), {
    addSuffix: true,
  });

  const formattedDateTime = format(
    formatISO(new Date(body.createdAt)),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  const [_, setVersion] = useQueryState(
    "version",
    parseAsInteger.withOptions({ shallow: false }),
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex cursor-pointer flex-col items-end rounded-xl border bg-white p-4 text-sm"
            onClick={() => setVersion(version)}
          >
            <p>latest revision</p>
            <span className="font-bold">{relativeTime}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-40 text-center text-xs">
          <p>{formattedDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
