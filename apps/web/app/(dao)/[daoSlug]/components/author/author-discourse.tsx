import { AuthorCard } from './author-card';

export const DiscourseAuthor = ({
  username,
  ens,
  avatar,
  currentVotingPower,
  eventVotingPower,
  discourseBaseUrl,
}: {
  username: string;
  ens: string | null | undefined;
  avatar: string;
  currentVotingPower: number | null | undefined;
  eventVotingPower: number | null;
  discourseBaseUrl: string;
}) => {
  return (
    <AuthorCard
      href={`${discourseBaseUrl}/u/${username}`}
      avatar={
        avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${username}`
      }
      altText={username}
      primaryName={username}
      secondaryName={ens || undefined}
      nameDisplayType='discourse'
      currentVotingPower={currentVotingPower}
      eventVotingPower={eventVotingPower}
    />
  );
};
