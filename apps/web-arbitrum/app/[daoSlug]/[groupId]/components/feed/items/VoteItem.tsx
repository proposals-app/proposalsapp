import { CombinedFeedItem, VoteFeedItem } from "../Feed";
import { format, formatDistanceToNowStrict, formatISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import { VotingPowerTag } from "./VotingPowerTag";
import { Suspense } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { getDelegate } from "../actions";
import { GroupWithDataType } from "../../../actions";
import { notFound } from "next/navigation";
import { formatNumberWithSuffix } from "@/lib/utils";
import { unstable_cache } from "next/cache";

const getDelegateCached = unstable_cache(
  async (
    voterAddress: string,
    daoSlug: string,
    topicIds: string[],
    proposalIds: string[],
  ) => {
    return await getDelegate(voterAddress, daoSlug, topicIds, proposalIds);
  },
  ["delegate"],
  { revalidate: 60 * 5, tags: ["delegate"] },
);

const isVoteItem = (item: CombinedFeedItem): item is VoteFeedItem => {
  return item.type === "vote";
};

export async function VoteItem({
  item,
  group,
}: {
  item: CombinedFeedItem;
  group: GroupWithDataType;
}) {
  if (!isVoteItem(item) || !group) {
    notFound();
  }

  const proposalIds = Array.from(new Set(group.proposals.map((p) => p.id)));
  const topicIds = Array.from(new Set(group.topics.map((t) => t.id)));
  const topicExternalIds = Array.from(
    new Set(group.topics.map((t) => t.externalId)),
  );

  const proposal = group.proposals.find((p) => p.id == item.proposalId);

  const delegate = await getDelegateCached(
    item.voterAddress,
    group.daoSlug,
    topicIds,
    proposalIds,
  );

  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.timestamp),
    {
      addSuffix: true,
    },
  );
  const utcTime = format(
    formatISO(item.timestamp),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  const formattedVotingPower = item.votingPower
    ? formatNumberWithSuffix(item.votingPower)
    : "0";

  const result = choiceToClass(
    (proposal?.choices ?? []) as string[],
    item.choice as number,
  );

  let resultClass = "";
  switch (result) {
    case Result.FOR:
      resultClass = "place-self-start";
      break;
    case Result.AGAINST:
      resultClass = "ml-20 place-self-end";
      break;
    case Result.ABSTAIN:
    case Result.UNKNOWN:
      resultClass = "place-self-center self-center";
      break;
    default:
      resultClass = "place-self-center self-center w-full";
  }

  const baseUrl = daoBaseUrlMap[group.daoSlug] || "";
  const urlPattern = new RegExp(`${baseUrl}/t/[^/]+/(\\d+)/(\\d+)(?:\\?.*)?`);
  let match = item.reason?.match(urlPattern);

  let anchorHref: string | null = null;
  if (match) {
    const topicId = match[1];
    const postNumber = match[2];
    if (topicExternalIds.includes(parseInt(topicId)))
      anchorHref = `#post-${postNumber}-${topicId}`;
    else match = null;
  }

  return (
    <div
      className={`${resultClass} flex w-2/3 flex-col gap-2 rounded-lg border p-4 shadow-sm`}
    >
      <div className="flex cursor-default select-none flex-row justify-between">
        <div className="flex flex-col gap-2">
          <Suspense>
            <AuthorInfo
              authorName={
                delegate?.delegatetodiscourseuser?.name ??
                delegate?.delegatetovoter?.ens ??
                item.voterAddress
              }
              authorPicture={delegate?.delegatetodiscourseuser?.avatarTemplate}
              voterAddress={
                delegate?.delegatetovoter?.ens ??
                `${item.voterAddress.slice(0, 6)}...${item.voterAddress.slice(-4)}`
              }
            />

            <VotingPowerTag
              item={item}
              proposalIds={proposalIds}
              topicIds={topicIds}
            />
          </Suspense>
        </div>

        <div className="flex flex-col items-end text-sm text-gray-500">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  voted <span className="font-bold">{relativeCreateTime}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{utcTime}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="cursor-default select-none">
        <p className="font-bold">{formattedVotingPower} ARB</p>
        <p className="font-bold">
          {((proposal?.choices ?? []) as string[])[item.choice as number]}
        </p>
      </div>

      <div className="flex flex-col">
        <p className="text-gray-500">{item.reason}</p>
        <p className="self-end text-gray-500">
          {match ? (
            <>
              <a
                href={anchorHref ?? ""}
                className="smooth-scroll-link text-sm font-bold text-gray-500 no-underline hover:underline"
              >
                jump to post →
              </a>{" "}
            </>
          ) : (
            <></>
          )}
        </p>
      </div>
    </div>
  );
}

const daoBaseUrlMap: { [key: string]: string } = {
  arbitrum_dao: "https://forum.arbitrum.foundation",
};

const AuthorInfo = ({
  authorName,
  authorPicture,
  voterAddress,
}: {
  authorName: string;
  authorPicture: string | null | undefined;
  voterAddress: string;
}) => {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

  let displayName = authorName;
  if (ethAddressRegex.test(authorName)) {
    displayName = `${authorName.slice(0, 6)}...${authorName.slice(-4)}`;
  }

  let displayPicture =
    authorPicture ??
    `https://api.dicebear.com/9.x/pixel-art/svg?seed=${authorName}`;

  return (
    <div className="flex flex-row items-center gap-2">
      <Avatar className="bg-gray-500">
        <AvatarImage src={displayPicture} />
        <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="font-bold">
        {displayName}{" "}
        <span className="text-gray-500"> with {voterAddress}</span>
      </div>
    </div>
  );
};

enum Result {
  FOR,
  ABSTAIN,
  AGAINST,
  UNKNOWN,
}
export const choiceToClass = (
  proposalChoices: string[],
  choiceIndex: number,
) => {
  try {
    switch (proposalChoices[choiceIndex].toLowerCase()) {
      case "for":
      case "yes":
      case "yae":
        return Result.FOR;
      case "against":
      case "no":
      case "nay":
        return Result.AGAINST;
      // Add additional cases for other choice patterns as needed
      default:
        return Result.ABSTAIN;
    }
  } catch {
    return Result.UNKNOWN;
  }
};
