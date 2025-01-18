import * as Tooltip from "@radix-ui/react-tooltip";
import { format, formatDistanceToNow, formatISO } from "date-fns";

// Helper component to display the time with a tooltip
export async function PostedTime({
  label,
  createdAt,
  border,
}: {
  label: string;
  createdAt: Date;
  border?: true;
}) {
  const relativeTime = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  const formattedDateTime = format(
    formatISO(new Date(createdAt)),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            className={`flex flex-col items-center p-2 ${border ? "rounded-lg border" : ""}`}
          >
            <span className="">{label}</span>
            <span className="font-bold">{relativeTime}</span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="w-40 rounded p-2 text-center text-xs shadow-lg"
            sideOffset={5}
          >
            <p>{formattedDateTime}</p>
            <Tooltip.Arrow className="" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
