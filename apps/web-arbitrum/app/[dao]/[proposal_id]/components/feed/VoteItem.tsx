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
}: {
  item: CombinedFeedItem;
  proposal?: Selectable<Proposal>;
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

  const result = choiceToClass(
    (proposal?.choices ?? []) as string[],
    item.choice as number,
  );

  const resultClass = `${result == Result.FOR ? "place-self-start bg-green-100 text-green-800" : ""} ${result == Result.AGAINST ? "ml-20 place-self-end bg-red-100 text-red-800" : ""} ${result == Result.ABSTAIN ? "place-self-center self-center bg-amber-100 text-amber-800" : ""} ${result == Result.UNKNOWN ? "place-self-center self-center bg-sky-100 text-sky-800" : ""}`;
  return (
    <div className={`${resultClass} w-2/3 rounded-lg border p-4 shadow-sm`}>
      <div className="flex flex-row justify-between">
        {<AuthorInfo authorName={item.voterAddress} />}
        <div className="flex flex-col items-end text-sm text-gray-500">
          <div>
            voted <span className="font-bold">{relativeCreateTime}</span>
          </div>
        </div>
      </div>

      <p>Voting Power: {item.votingPower?.toString()}</p>
      <p>Choice: {JSON.stringify(item.choice)}</p>
    </div>
  );
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
