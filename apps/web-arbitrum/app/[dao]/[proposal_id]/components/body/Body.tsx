import { notFound } from "next/navigation";
import {
  BodiesDataType,
  getBodiesForGroup,
  GroupDataType,
} from "../../actions";
import { format, formatDistanceToNow, formatISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import ContentSectionClient from "./ContentSectionClient";

export default async function Body({
  bodies,
  version,
}: {
  bodies: BodiesDataType;
  version: number;
}) {
  if (!bodies || bodies.length === 0) {
    return <div className="w-full bg-gray-100 p-4">No bodies found.</div>;
  }

  // Find the initial and latest bodies based on createdAt
  const initialBody = bodies[0];
  const latestBody = bodies[bodies.length - 1];
  const visibleBody = bodies[version];

  return (
    <div className="flex w-full justify-center bg-gray-100 p-4">
      <div className="flex w-3/4 flex-col gap-4">
        <div className="text-4xl font-bold">{visibleBody.title}</div>

        <div className="flex flex-col">
          <div className="flex flex-row justify-between">
            <AuthorInfo
              authorName={visibleBody.author_name}
              authorPicture={visibleBody.author_picture}
            />

            <div className="flex flex-row">
              <PostedTime
                label="initially posted"
                createdAt={initialBody.createdAt}
              />

              <PostedTime
                label="latest revision"
                createdAt={latestBody.createdAt}
                border
              />
            </div>
          </div>
        </div>

        <ContentSectionClient content={visibleBody.content} />
      </div>
    </div>
  );
}

const AuthorInfo = ({
  authorName,
  authorPicture,
}: {
  authorName: string;
  authorPicture: string;
}) => (
  <div className="flex flex-row items-center gap-2">
    <Avatar className="bg-gray-500">
      <AvatarImage src={authorPicture} />
      <AvatarFallback>{authorName.slice(0, 2)}</AvatarFallback>
    </Avatar>
    <div className="font-bold">{authorName}</div>
  </div>
);

// Helper component to display the time with a tooltip
const PostedTime = ({
  label,
  createdAt,
  border,
}: {
  label: string;
  createdAt: Date;
  border?: true;
}) => {
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
