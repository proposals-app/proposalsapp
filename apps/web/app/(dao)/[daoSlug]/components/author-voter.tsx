import { AuthorCard } from '@/app/components/author-card';

export const VoterAuthor = ({
  voterAddress,
  ens,
  discourseUsername,
  avatar,
  currentVotingPower,
  eventVotingPower,
}: {
  voterAddress: string;
  ens: string | null;
  discourseUsername: string | null;
  avatar: string;
  currentVotingPower: number | null;
  eventVotingPower: number | null;
}) => {
  const displayName =
    ens ||
    discourseUsername ||
    `${voterAddress.slice(0, 6)}...${voterAddress.slice(-4)}`;

  return (
    <AuthorCard
      href={`https://dune.com/entropy_advisors/arbitrum-dao-delegates?Delegate_t7d9d1=${voterAddress}#5-deep-dive-on-delegates`}
      avatar={avatar}
      altText={voterAddress}
      primaryName={displayName}
      nameDisplayType='voter'
      currentVotingPower={currentVotingPower}
      eventVotingPower={eventVotingPower}
    />
  );
};
