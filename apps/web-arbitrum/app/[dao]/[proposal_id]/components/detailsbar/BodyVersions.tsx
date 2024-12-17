import Link from "next/link";
import { notFound } from "next/navigation";
import { Body } from "../../actions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { format, formatDistanceToNow, formatISO } from "date-fns";

interface BodyVersionProps {
  body: Body;
  versionIndex: number; // Add this prop to pass the index of the body
  pathname: string; // Pathname for the Link component
  searchParams: URLSearchParams; // Search parameters for the Link component
}

export default function BodyVersion({
  body,
  versionIndex,
  pathname,
  searchParams,
}: BodyVersionProps) {
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

  // Clone search params and set the version query parameter
  const newSearchParams = new URLSearchParams(searchParams);
  newSearchParams.set("version", versionIndex.toString());

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={{ pathname, search: newSearchParams.toString() }}>
            <div className="flex cursor-pointer flex-col items-center rounded-lg border bg-white p-2">
              <span className="font-bold">{relativeTime}</span>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="w-40 text-center text-xs">
          <p>{formattedDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
