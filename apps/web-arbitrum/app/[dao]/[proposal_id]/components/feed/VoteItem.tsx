import { Proposal, Selectable } from "@proposalsapp/db";
import { CombinedFeedItem, VoteFeedItem } from "./Feed";
import { formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";

const isVoteItem = (item: CombinedFeedItem): item is VoteFeedItem => {
  return item.type === "vote";
};

export const VoteItem = ({
  item,
  proposal,
  topicIds,
}: {
  item: CombinedFeedItem;
  proposal?: Selectable<Proposal>;
  topicIds: number[];
}) => {
  if (!isVoteItem(item)) {
    return null;
  }

  const relativeCreateTime = formatDistanceToNowStrict(
    new Date(item.timestamp),
    {
      addSuffix: true,
    },
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

  const urlPattern =
    /https:\/\/forum\.arbitrum\.foundation\/t\/[^/]+\/(\d+)\/(\d+)/;
  let match = item.reason?.match(urlPattern);

  let anchorHref: string | null = null;
  if (match) {
    const topicId = match[1];
    const postNumber = match[2];
    if (topicIds.includes(parseInt(topicId)))
      anchorHref = `#post-${postNumber}-${topicId}`;
    else match = null;
  }
  return (
    <div
      className={`${resultClass} flex w-2/3 flex-col gap-2 rounded-lg border p-4 shadow-sm`}
    >
      <div className="flex flex-row justify-between">
        {<AuthorInfo authorName={item.voterAddress} />}
        <div className="flex flex-col items-end text-sm text-gray-500">
          <div>
            voted <span className="font-bold">{relativeCreateTime}</span>
          </div>
        </div>
      </div>

      <div>
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
};

const formatNumberWithSuffix = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}m`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  } else {
    return num.toString();
  }
};

const AuthorInfo = ({ authorName }: { authorName: string }) => {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

  let displayName = authorName;
  let displayPicture;
  if (ethAddressRegex.test(authorName)) {
    displayName = `${authorName.slice(0, 6)}...${authorName.slice(-4)}`;
    displayPicture = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${authorName}`;
  }

  return (
    <div className="flex flex-row items-center gap-2">
      <Avatar className="bg-gray-500">
        <AvatarImage src={displayPicture} />
        <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="font-bold">{displayName}</div>
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
