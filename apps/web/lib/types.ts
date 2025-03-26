import { Proposal, Selectable } from '@proposalsapp/db-indexer';
import { ProcessedResults } from './results_processing';

export interface ProposalGroup {
  id: string;
  name: string;
  items: ProposalGroupItem[];
  daoId: string;
  createdAt?: string;
}

export type ProposalGroupItem =
  | {
      type: 'topic';
      name: string;
      externalId: string;
      daoDiscourseId: string;
    }
  | {
      type: 'proposal';
      name: string;
      externalId: string;
      governorId: string;
    };

export enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  Onchain = 'Onchain',
  Offchain = 'Offchain',
  Discussion = 'Discussion',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
}

export interface BaseEvent {
  type: TimelineEventType;
  timestamp: Date;
  metadata?: {
    votingPower?: number;
    commentCount?: number;
  };
}

export interface BasicEvent extends BaseEvent {
  type: TimelineEventType.Basic;
  content: string;
  url: string;
}

export interface OnchainEvent extends BaseEvent {
  type: TimelineEventType.Onchain;
  content: string;
  url: string;
}

export interface OffchainEvent extends BaseEvent {
  type: TimelineEventType.Offchain;
  content: string;
  url: string;
}

export interface DiscussionEvent extends BaseEvent {
  type: TimelineEventType.Discussion;
  content: string;
  url: string;
}

export interface CommentsVolumeEvent extends BaseEvent {
  type: TimelineEventType.CommentsVolume;
  volume: number;
  maxVolume: number;
  volumeType: 'comments';
}

export interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  volumes: number[];
  colors: string[];
  maxVolume: number;
  volumeType: 'votes';
  metadata: {
    votingPower: number;
  };
}

export interface VoteSegmentData {
  votingPower: number;
  isAggregated?: boolean;
}

export interface ResultEvent extends BaseEvent {
  type:
    | TimelineEventType.ResultOngoingBasicVote
    | TimelineEventType.ResultOngoingOtherVotes
    | TimelineEventType.ResultEndedBasicVote
    | TimelineEventType.ResultEndedOtherVotes;
  content: string;
  proposal: Selectable<Proposal>;
  result: Omit<ProcessedResults, 'votes' | 'timeSeriesData'> & {
    voteSegments: { [key: string]: VoteSegmentData[] };
  };
}

export type FeedEvent =
  | BasicEvent
  | DiscussionEvent
  | OnchainEvent
  | OffchainEvent
  | CommentsVolumeEvent
  | VotesVolumeEvent
  | ResultEvent;
