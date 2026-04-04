import { AuthorCard } from './author-card';
import { getDaoDelegateProfileUrl, getDaoTokenSymbol } from '@/lib/dao-config';

export const VoterAuthor = ({
  daoSlug,
  voterAddress,
  ens,
  discourseUsername,
  avatar,
  currentVotingPower,
  eventVotingPower,
}: {
  daoSlug: string;
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
  const href = getDaoDelegateProfileUrl(daoSlug, voterAddress);

  return (
    <AuthorCard
      href={href}
      avatar={avatar}
      altText={voterAddress}
      primaryName={displayName}
      nameDisplayType='voter'
      currentVotingPower={currentVotingPower}
      eventVotingPower={eventVotingPower}
      tokenSymbol={getDaoTokenSymbol(daoSlug)}
    />
  );
};
