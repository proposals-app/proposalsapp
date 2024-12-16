import { notFound } from "next/navigation";
import { GroupDataProps } from "../../page";
import { getBodiesForGroup } from "../../actions";
import { format, formatDistanceToNow, formatISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";

export default async function Body({ groupData }: GroupDataProps) {
  if (!groupData) {
    notFound();
  }

  const bodies = await getBodiesForGroup(groupData.group.id);

  if (!bodies || bodies.length === 0) {
    return <div className="w-full bg-gray-100 p-4">No bodies found.</div>;
  }

  // Find the initial and latest bodies based on createdAt
  const initialBody = bodies[0];
  const latestBody = bodies[bodies.length - 1];

  return (
    <div className="flex w-full justify-center bg-gray-100 p-4">
      <div className="flex w-3/4 flex-col gap-4">
        <div className="text-4xl font-bold">{latestBody.title}</div>

        <div className="flex flex-col">
          <div className="flex flex-row justify-between">
            <div className="flex flex-row items-center gap-2">
              <Avatar className="bg-gray-500">
                <AvatarImage src={latestBody.author_picture} />
                <AvatarFallback>
                  {latestBody.author_name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="font-bold">{latestBody.author_name}</div>
            </div>
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

        <div className="flex flex-col gap-4">
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={parseMarkdown(latestBody.content)}
          />
        </div>
      </div>
    </div>
  );
}

// Simple Markdown parser
const parseMarkdown = (markdown: string) => {
  // Convert headers
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  let parsedContent = markdown.replace(headerRegex, (match, hashes, text) => {
    const level = hashes.length;
    return `<h${level}>${text}</h${level}>`;
  });

  // Convert bold and italic
  const boldItalicRegex = /(\*\*|__)(.*?)\1/g;
  parsedContent = parsedContent.replace(
    boldItalicRegex,
    (match, stars, text) => {
      if (stars === "**" || stars === "__") {
        return `<strong>${text}</strong>`;
      }
      return match;
    },
  );

  // Convert italic
  const italicRegex = /(\*|_)(.*?)\1/g;
  parsedContent = parsedContent.replace(italicRegex, (match, star, text) => {
    if (star === "*" || star === "_") {
      return `<em>${text}</em>`;
    }
    return match;
  });

  // Convert links
  const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
  parsedContent = parsedContent.replace(linkRegex, '<a href="$2">$1</a>');

  // Convert images
  const imageRegex = /!\[([^\]]+)\]\(([^\)]+)\)/g;
  parsedContent = parsedContent.replace(imageRegex, '<img src="$2" alt="$1">');

  // Convert lists
  const listRegex = /^(\s*[-+*]|\d+\.)\s+(.*)$/gm;
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  parsedContent = parsedContent.replace(
    listRegex,
    (match, bulletOrNumber, text) => {
      const isOrdered = /\d+\./.test(bulletOrNumber);
      if (!inList) {
        inList = true;
        listType = isOrdered ? "ol" : "ul";
        return `<${listType}><li>${text}</li>`;
      } else if (isOrdered !== (listType === "ol")) {
        // Change of list type
        const closeTag = `</${listType}>`;
        listType = isOrdered ? "ol" : "ul";
        const openTag = `<${listType}>`;
        return `${closeTag}${openTag}<li>${text}</li>`;
      } else {
        return `<li>${text}</li>`;
      }
    },
  );

  if (inList) {
    parsedContent += `</${listType}>`;
  }

  // Convert paragraphs
  parsedContent = parsedContent.replace(/\n{2,}/g, "</p><p>");

  // Wrap in paragraph tags if not already wrapped
  if (!parsedContent.startsWith("<p>")) {
    parsedContent = `<p>${parsedContent}</p>`;
  }

  return { __html: parsedContent };
};

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
