export interface BaseTimelineContent {
  timestamp: Date;
}

export interface ProposalContent {
  url: string;
  name: string;
  body: string;
}

export interface DiscussionContent {
  topicTitle?: string;
  username?: string;
  cooked?: string;
  discourseBaseUrl?: string;
  externalId?: string;
  title?: string;
}

export interface PostContent {
  topicTitle: string;
  username: string;
  cooked: string;
  discourseBaseUrl?: string;
  externalId?: string;
}

export interface VoteContent {
  proposalName: string;
  voterAddress: string;
  votingPower: string;
  choice: string[] | string;
  reason?: string;
}

export interface AggregatedVotesContent {
  proposalName: string;
  votes: Array<{
    choice: string;
    count: number;
    votingPower: string;
  }>;
  totalVotes: number;
  totalVotingPower: string;
}

export interface ProcessedTimelineItem {
  type: "proposal" | "discussion" | "vote" | "post" | "aggregated_votes";
  timestamp: Date;
  content:
    | ProposalContent
    | DiscussionContent
    | PostContent
    | VoteContent
    | AggregatedVotesContent;
}
