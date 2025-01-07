import { notFound } from "next/navigation";
import { GroupWithDataType } from "../../actions";
import { extractEvents, TimelineEventType } from "./timeline_events";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";

export async function Timeline({ group }: { group: GroupWithDataType }) {
  if (!group) {
    notFound();
  }

  const events = await extractEvents(group);

  return (
    <TooltipProvider>
      <div className="fixed right-0 top-0 flex h-screen w-80 flex-col items-end justify-start gap-1 overflow-y-auto bg-gray-200 p-4 pt-24 shadow-md">
        {events.map((event, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <div className="flex w-full items-center justify-start">
                {event.type === TimelineEventType.Gap ? (
                  <div
                    className="w-full opacity-30"
                    style={{
                      height: `${event.gapSize}vh`,
                      minHeight: "1rem",
                      borderLeft: "2px dashed #666",
                      margin: "0.5rem 0 0.5rem 50%",
                    }}
                  />
                ) : (event.type === TimelineEventType.CommentsVolume ||
                    event.type === TimelineEventType.VotesVolume) &&
                  event.volume ? (
                  <div
                    className={`mt-1 h-1 rounded-full ${
                      event.volumeType === "comments"
                        ? "bg-gray-400"
                        : "bg-gray-600"
                    }`}
                    style={{
                      width: `${Math.max(event.volume * 80, 1)}%`,
                    }}
                  />
                ) : (
                  <div className="w-full rounded-lg bg-white p-1 shadow-md">
                    {event.content}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              <p>{format(event.timestamp, "MMM d, yyyy h:mm a")}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// Helper function to format the timestamp
function format(date: Date, formatString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
}
