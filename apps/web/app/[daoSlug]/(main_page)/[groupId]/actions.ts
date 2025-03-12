import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { otel } from '@/lib/otel';
import {
  ProcessedResults,
  ProcessedVote,
  processResultsAction,
} from '@/lib/results_processing';
import { ProposalGroupItem } from '@/lib/types';
import { AsyncReturnType, formatNumberWithSuffix } from '@/lib/utils';
import {
  db,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
  Vote,
} from '@proposalsapp/db-indexer';
import { unstable_cache } from 'next/cache';
import { validate } from 'uuid';
import { getDelegateByDiscourseUser } from './components/feed/actions';
import { format } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import { ProposalMetadata } from '@/app/types';

async function getGroup(daoSlug: string, groupId: string) {
  'use server';
  return otel('get-group', async () => {
    if (daoSlug == 'favicon.ico') return null;

    // Fetch the DAO based on the slug
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) {
      return null;
    }

    let group: Selectable<ProposalGroup> | null = null;

    // Check if proposalOrGroupId is a UUIDv4
    if (validate(groupId)) {
      try {
        // Fetch the group based on ID
        group =
          (await db
            .selectFrom('proposalGroup')
            .where('id', '=', groupId)
            .selectAll()
            .executeTakeFirst()) ?? null;
      } catch (error) {
        console.error('Error fetching group:', error);
      }
    }

    if (group) {
      const items = group.items as ProposalGroupItem[];

      const proposalItems = items.filter((item) => item.type === 'proposal');
      const topicItems = items.filter((item) => item.type === 'topic');

      const proposals: Selectable<Proposal>[] = [];
      if (proposalItems.length > 0) {
        for (const proposalItem of proposalItems) {
          try {
            const p = await db
              .selectFrom('proposal')
              .selectAll()
              .where('externalId', '=', proposalItem.externalId)
              .where('governorId', '=', proposalItem.governorId)
              .executeTakeFirstOrThrow();

            proposals.push(p);
          } catch (error) {
            console.error('Error fetching:', proposalItem, error);
          }
        }
      }

      const topics: Selectable<DiscourseTopic>[] = [];
      if (topicItems.length > 0) {
        for (const topicItem of topicItems) {
          try {
            const t = await db
              .selectFrom('discourseTopic')
              .where('externalId', '=', parseInt(topicItem.externalId, 10))
              .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
              .selectAll()
              .executeTakeFirstOrThrow();

            topics.push(t);
          } catch (error) {
            console.error('Error fetching:', topicItem, error);
          }
        }
      }

      return {
        dao,
        group,
        proposals,
        topics,
        daoSlug,
        groupId,
      };
    }
  });
}

export type BodyType = {
  title: string;
  content: string;
  author_name: string;
  author_picture: string;
  createdAt: Date;
  type: VersionType;
};

export type VersionType = 'topic' | 'onchain' | 'offchain';

async function getBodies(groupID: string) {
  'use server';
  return otel('get-bodies-', async () => {
    const bodies: BodyType[] = [];

    const group = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('id', '=', groupID)
      .executeTakeFirstOrThrow();

    if (!group) {
      return null;
    }

    const items = group.items as ProposalGroupItem[];

    const proposalItems = items.filter((item) => item.type === 'proposal');
    const topicItems = items.filter((item) => item.type === 'topic');

    const proposals: Selectable<Proposal>[] = [];
    if (proposalItems.length > 0) {
      for (const proposalItem of proposalItems) {
        try {
          const p = await db
            .selectFrom('proposal')
            .selectAll()
            .where('externalId', '=', proposalItem.externalId)
            .where('governorId', '=', proposalItem.governorId)
            .executeTakeFirstOrThrow();

          proposals.push(p);
        } catch (error) {
          console.error('Error fetching:', proposalItem, error);
        }
      }
    }

    proposals.map((proposal) =>
      bodies.push({
        title: proposal.name,
        content: proposal.body,
        author_name: proposal.author ?? 'Unknown',
        author_picture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
        createdAt: proposal.createdAt,
        type: proposal.blockCreatedAt ? 'onchain' : 'offchain',
      })
    );

    const discourseTopics: Selectable<DiscourseTopic>[] = [];
    if (topicItems.length > 0) {
      for (const topicItem of topicItems) {
        try {
          const t = await db
            .selectFrom('discourseTopic')
            .where('externalId', '=', parseInt(topicItem.externalId, 10))
            .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
            .selectAll()
            .executeTakeFirstOrThrow();

          discourseTopics.push(t);
        } catch (error) {
          console.error('Error fetching:', topicItem, error);
        }
      }
    }

    for (const discourseTopic of discourseTopics) {
      const discourseFirstPost = await db
        .selectFrom('discoursePost')
        .where('discoursePost.topicId', '=', discourseTopic.externalId)
        .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
        .where('discoursePost.postNumber', '=', 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostAuthor = await db
        .selectFrom('discourseUser')
        .where('discourseUser.externalId', '=', discourseFirstPost.userId)
        .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostRevisions = await db
        .selectFrom('discoursePostRevision')
        .where(
          'discoursePostRevision.discoursePostId',
          '=',
          discourseFirstPost.id
        )
        .selectAll()
        .execute();

      // If there are no revisions, use the post itself
      if (!discourseFirstPostRevisions.length)
        bodies.push({
          title: discourseTopic.title,
          content: discourseFirstPost.cooked ?? 'Unknown',
          author_name:
            discourseFirstPostAuthor.name?.trim() ||
            discourseFirstPostAuthor.username ||
            'Unknown',
          author_picture: discourseFirstPostAuthor.avatarTemplate,
          createdAt: discourseFirstPost.createdAt,
          type: 'topic',
        });

      for (const discourseFirstPostRevision of discourseFirstPostRevisions) {
        // If there are revisions, the initial post is in fact the before of version 2
        if (discourseFirstPostRevision.version == 2)
          bodies.push({
            title:
              discourseFirstPostRevision.cookedTitleBefore ??
              discourseTopic.title,
            content:
              discourseFirstPostRevision.cookedBodyBefore ??
              discourseFirstPost.cooked ??
              'Unknown',
            author_name:
              discourseFirstPostAuthor.name?.trim() ||
              discourseFirstPostAuthor.username ||
              'Unknown',
            author_picture: discourseFirstPostAuthor.avatarTemplate,
            createdAt: discourseFirstPost.createdAt,
            type: 'topic',
          });

        bodies.push({
          title:
            discourseFirstPostRevision.cookedTitleAfter ?? discourseTopic.title,
          content:
            discourseFirstPostRevision.cookedBodyAfter ??
            discourseFirstPost.cooked ??
            'Unknown',
          author_name:
            discourseFirstPostAuthor.name?.trim() ||
            discourseFirstPostAuthor.username ||
            'Unknown',
          author_picture: discourseFirstPostAuthor.avatarTemplate,
          createdAt: discourseFirstPostRevision.createdAt,
          type: 'topic',
        });
      }
    }

    bodies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return bodies;
  });
}

async function getTotalVersions(groupID: string) {
  'use server';
  return otel('get-total-versions', async () => {
    let totalVersions = 0;

    const group = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('id', '=', groupID)
      .executeTakeFirst();

    if (!group) {
      return null;
    }

    const items = group.items as ProposalGroupItem[];

    const proposalItems = items.filter((item) => item.type === 'proposal');
    const topicItems = items.filter((item) => item.type === 'topic');

    const proposals: Selectable<Proposal>[] = [];
    if (proposalItems.length > 0) {
      for (const proposalItem of proposalItems) {
        try {
          const p = await db
            .selectFrom('proposal')
            .selectAll()
            .where('externalId', '=', proposalItem.externalId)
            .where('governorId', '=', proposalItem.governorId)
            .executeTakeFirstOrThrow();

          proposals.push(p);
        } catch (error) {
          console.error('Error fetching:', proposalItem, error);
        }
      }
    }

    const discourseTopics: Selectable<DiscourseTopic>[] = [];
    if (topicItems.length > 0) {
      for (const topicItem of topicItems) {
        try {
          const t = await db
            .selectFrom('discourseTopic')
            .where('externalId', '=', parseInt(topicItem.externalId, 10))
            .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
            .selectAll()
            .executeTakeFirstOrThrow();

          discourseTopics.push(t);
        } catch (error) {
          console.error('Error fetching:', topicItem, error);
        }
      }
    }

    totalVersions += proposals.length;

    for (const discourseTopic of discourseTopics) {
      const discourseFirstPost = await db
        .selectFrom('discoursePost')
        .where('discoursePost.topicId', '=', discourseTopic.externalId)
        .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
        .where('discoursePost.postNumber', '=', 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      totalVersions++;

      const discourseFirstPostRevisions = await db
        .selectFrom('discoursePostRevision')
        .where(
          'discoursePostRevision.discoursePostId',
          '=',
          discourseFirstPost.id
        )
        .selectAll()
        .execute();

      totalVersions += discourseFirstPostRevisions.length;
    }

    return totalVersions;
  });
}

enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
  Gap = 'Gap',
}

interface BaseEvent {
  type: TimelineEventType;
  timestamp: Date;
  metadata?: {
    votingPower?: number;
    commentCount?: number;
  };
}

interface BasicEvent extends BaseEvent {
  type: TimelineEventType.Basic;
  content: string;
  url: string;
}

interface CommentsVolumeEvent extends BaseEvent {
  type: TimelineEventType.CommentsVolume;
  volume: number;
  maxVolume: number;
  volumeType: 'comments';
}

interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  volume: number;
  maxVolume: number;
  volumeType: 'votes';
  metadata: {
    votingPower: number;
  };
}

interface GapEvent extends BaseEvent {
  type: TimelineEventType.Gap;
  content: string;
  gapSize: number;
}

export interface VoteSegmentData {
  votingPower: number;
  tooltip: string;
  isAggregated?: boolean;
}

interface ResultEvent extends BaseEvent {
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
  | CommentsVolumeEvent
  | VotesVolumeEvent
  | GapEvent
  | ResultEvent;

const MIN_VISIBLE_WIDTH_PERCENT = 1;

function calculateVoteSegments(processedResults: ProcessedResults): {
  [key: string]: VoteSegmentData[];
} {
  const { totalVotingPower, choices, votes } = processedResults;

  const sortedVotes =
    votes
      ?.filter((vote) => !vote.aggregate)
      .sort((a, b) => b.votingPower - a.votingPower) || [];

  const voteSegments: { [key: string]: VoteSegmentData[] } = {};
  const aggregatedVotes: { [key: number]: { count: number; power: number } } =
    {};

  choices.forEach((_, index) => {
    voteSegments[index.toString()] = [];
    aggregatedVotes[index] = { count: 0, power: 0 };
  });

  sortedVotes.forEach((vote) => {
    const choice = vote.choice as number;

    // Ensure the choice is a valid index in the choices array
    if (choice >= 0 && choice < choices.length) {
      const percentage = (vote.votingPower / totalVotingPower) * 100;

      if (percentage >= MIN_VISIBLE_WIDTH_PERCENT) {
        voteSegments[choice.toString()].push({
          votingPower: vote.votingPower,
          tooltip: `${formatNumberWithSuffix(vote.votingPower)} vote "${
            choices[choice]
          }"`,
        });
      } else {
        aggregatedVotes[choice].count += 1;
        aggregatedVotes[choice].power += vote.votingPower;
      }
    } else {
      console.warn(`Invalid choice index: ${choice}. Skipping this vote.`);
    }
  });

  Object.entries(aggregatedVotes).forEach(([choice, data]) => {
    if (data.power > 0) {
      voteSegments[choice.toString()].push({
        votingPower: data.power,
        tooltip: `${data.count} votes with ${formatNumberWithSuffix(
          data.power
        )} total voting power for "${choices[parseInt(choice)]}"`,
        isAggregated: true,
      });
    }
  });
  return voteSegments;
}

export async function getFeed(
  groupID: string,
  feedFilter: FeedFilterEnum,
  votesFilter: VotesFilterEnum
): Promise<{
  votes: ProcessedVote[];
  posts: Selectable<DiscoursePost>[];
  events: FeedEvent[];
}> {
  'use server';
  return otel('get-feed-for-group', async () => {
    try {
      // Fetch the proposal group
      const group = await db
        .selectFrom('proposalGroup')
        .selectAll()
        .where('id', '=', groupID)
        .executeTakeFirstOrThrow();

      const dao = await db
        .selectFrom('dao')
        .selectAll()
        .where('dao.id', '=', group.daoId)
        .executeTakeFirstOrThrow();

      const daoDiscourse = await db
        .selectFrom('daoDiscourse')
        .selectAll()
        .where('daoId', '=', group.daoId)
        .executeTakeFirstOrThrow();

      if (!group) {
        return { votes: [], posts: [], events: [] };
      }

      let posts: Selectable<DiscoursePost>[] = [];

      const allVotes: Selectable<Vote>[] = [];
      const processedVotes: ProcessedVote[] = [];

      const events: FeedEvent[] = [];

      // Extract proposal and topic IDs from group items
      const items = group.items as ProposalGroupItem[];

      const proposalItems = items.filter((item) => item.type === 'proposal');
      const topicItems = items.filter((item) => item.type === 'topic');

      const proposals: Selectable<Proposal>[] = [];
      const topics: Selectable<DiscourseTopic>[] = [];

      if (proposalItems.length > 0) {
        for (const proposalItem of proposalItems) {
          try {
            const proposal = await db
              .selectFrom('proposal')
              .selectAll()
              .where('externalId', '=', proposalItem.externalId)
              .where('governorId', '=', proposalItem.governorId)
              .executeTakeFirstOrThrow();

            const allVotesForProposal = await db
              .selectFrom('vote')
              .selectAll()
              .where('proposalId', '=', proposal.id)
              .execute();

            const filteredVotesForTimeline = allVotesForProposal.filter(
              (vote) => {
                if (votesFilter === VotesFilterEnum.FIFTY_THOUSAND) {
                  return vote.votingPower > 50000;
                } else if (
                  votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND
                ) {
                  return vote.votingPower > 500000;
                } else if (votesFilter === VotesFilterEnum.FIVE_MILLION) {
                  return vote.votingPower > 5000000;
                }
                return true;
              }
            );

            proposals.push(proposal);
            allVotes.push(...allVotesForProposal);

            const dailyFilteredVotesMap = new Map<
              string,
              { totalVotingPower: number; lastVoteTime: Date }
            >();
            filteredVotesForTimeline.forEach((vote) => {
              // Use allVotesForProposal here
              // Get the date in locale format (e.g., "MM/DD/YYYY" or "DD/MM/YYYY") to use as key
              const date = vote.createdAt.toLocaleDateString();
              const votingPower = vote.votingPower;

              if (dailyFilteredVotesMap.has(date)) {
                const dailyData = dailyFilteredVotesMap.get(date)!;
                dailyData.totalVotingPower += votingPower;
                dailyData.lastVoteTime = vote.createdAt; // Update last vote time to the latest vote in the day
              } else {
                dailyFilteredVotesMap.set(date, {
                  totalVotingPower: votingPower,
                  lastVoteTime: vote.createdAt,
                });
              }
            });
            const dailyFilteredVotes = Array.from(
              dailyFilteredVotesMap.values()
            );

            const maxVotes = Math.max(
              ...dailyFilteredVotes.map((dv) => Number(dv.totalVotingPower)),
              0 // Ensure maxVotes is at least 0 if there are no votes
            );

            dailyFilteredVotes.forEach((dailyVote) => {
              const dailyVotingPower = Number(dailyVote.totalVotingPower);
              const timestamp = new Date(dailyVote.lastVoteTime);
              events.push({
                type: TimelineEventType.VotesVolume,
                timestamp,
                volume: filteredVotesForTimeline.reduce((sum, vote) => {
                  // Recalculate volume with filtered votes for timeline
                  const voteDate = vote.createdAt.toLocaleDateString();
                  return voteDate ===
                    dailyVote.lastVoteTime.toLocaleDateString()
                    ? sum + vote.votingPower
                    : sum;
                }, 0),
                maxVolume: maxVotes, // maxVolume is still based on all votes
                volumeType: 'votes',
                metadata: {
                  votingPower: dailyVotingPower,
                },
              });
            });

            const startedAt = new Date(proposal.startAt);
            const endedAt = new Date(proposal.endAt);

            const daoGovernor = await db
              .selectFrom('daoGovernor')
              .selectAll()
              .where('id', '=', proposal.governorId)
              .executeTakeFirstOrThrow();

            const offchain = daoGovernor.type.includes('SNAPSHOT');

            const currentTimestamp = new Date();

            events.push({
              content: `${offchain ? 'Offchain' : 'Onchain'} vote ${currentTimestamp > startedAt ? 'started' : 'starts'} on ${format(
                startedAt,
                'MMM d'
              )}`,
              type: TimelineEventType.Basic,
              timestamp: startedAt,
              url: proposal.url,
            });

            if (currentTimestamp >= startedAt) {
              const processedResults = await processResultsAction(
                proposal,
                allVotesForProposal,
                {
                  withVotes: true,
                  withTimeseries: false,
                  aggregatedVotes: false,
                }
              );

              if (
                processedResults.votes &&
                (feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES ||
                  feedFilter == FeedFilterEnum.VOTES)
              ) {
                processedVotes.push(
                  ...processedResults.votes.filter((vote) => {
                    if (votesFilter === VotesFilterEnum.FIFTY_THOUSAND) {
                      return vote.votingPower > 50000;
                    } else if (
                      votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND
                    ) {
                      return vote.votingPower > 500000;
                    } else if (votesFilter === VotesFilterEnum.FIVE_MILLION) {
                      return vote.votingPower > 5000000;
                    }
                    return true;
                  })
                );
              }

              const voteSegments = calculateVoteSegments(processedResults);

              const metadata =
                typeof proposal.metadata === 'string'
                  ? (JSON.parse(proposal.metadata) as ProposalMetadata)
                  : (proposal.metadata as ProposalMetadata);

              const voteType = metadata?.voteType;

              if (currentTimestamp > endedAt) {
                events.push({
                  content: `${offchain ? 'Offchain' : 'Onchain'} vote ended ${formatDistanceToNow(
                    endedAt,
                    { addSuffix: true }
                  )}`,
                  type:
                    voteType === 'basic'
                      ? TimelineEventType.ResultEndedBasicVote
                      : TimelineEventType.ResultEndedOtherVotes,
                  timestamp: endedAt,
                  result: { ...processedResults, voteSegments },
                  proposal,
                });
              } else {
                events.push({
                  content: `${offchain ? 'Offchain' : 'Onchain'} vote ends ${formatDistanceToNow(
                    endedAt,
                    { addSuffix: true }
                  )}`,
                  type:
                    voteType === 'basic'
                      ? TimelineEventType.ResultOngoingBasicVote
                      : TimelineEventType.ResultOngoingOtherVotes,
                  timestamp: endedAt,
                  result: { ...processedResults, voteSegments },
                  proposal,
                });
              }
            }
          } catch (error) {
            console.error('Error fetching:', proposalItem, error);
          }
        }
      }

      if (topicItems.length > 0) {
        for (const topicItem of topicItems) {
          try {
            const t = await db
              .selectFrom('discourseTopic')
              .where('externalId', '=', parseInt(topicItem.externalId, 10))
              .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
              .selectAll()
              .executeTakeFirstOrThrow();

            topics.push(t);
          } catch (error) {
            console.error('Error fetching:', topicItem, error);
          }
        }
      }

      const createdAt = new Date(topics[0].createdAt);
      events.push({
        content: `Proposal initially posted on ${format(createdAt, 'MMM d')}`,
        type: TimelineEventType.Basic,
        timestamp: createdAt,
        url: `${daoDiscourse.discourseBaseUrl}/t/${topics[0].externalId}`,
      });

      if (
        topics.length > 0 &&
        (feedFilter == FeedFilterEnum.COMMENTS ||
          feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES)
      ) {
        posts = await db
          .selectFrom('discoursePost')
          .where(
            'topicId',
            'in',
            topics.map((t) => t.externalId)
          )
          .where('daoDiscourseId', '=', daoDiscourse.id)
          .where('postNumber', '!=', 1)
          .selectAll()
          .orderBy('createdAt', 'desc')
          .execute();

        const filteredPosts = await Promise.all(
          posts.map(async (post) => {
            const delegate = await getDelegateByDiscourseUser(
              post.userId,
              dao.slug,
              false,
              topics.map((t) => t.id.toString()),
              proposals.map((p) => p.id)
            );

            const authorVotingPower =
              delegate?.delegatetovoter?.latestVotingPower?.votingPower || 0;

            if (votesFilter === VotesFilterEnum.ALL) {
              return post;
            } else if (
              votesFilter === VotesFilterEnum.FIFTY_THOUSAND &&
              authorVotingPower > 50000
            ) {
              return post;
            } else if (
              votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND &&
              authorVotingPower > 500000
            ) {
              return post;
            } else if (
              votesFilter === VotesFilterEnum.FIVE_MILLION &&
              authorVotingPower > 5000000
            ) {
              return post;
            }
            return null;
          })
        );

        posts = filteredPosts.filter(Boolean) as Selectable<DiscoursePost>[];

        const dailyPostsMap = new Map<
          string,
          { count: number; lastPostTime: Date }
        >();
        posts.forEach((post) => {
          // Get the date in locale format (e.g., "MM/DD/YYYY" or "DD/MM/YYYY") to use as key
          const date = post.createdAt.toLocaleDateString();

          if (dailyPostsMap.has(date)) {
            const dailyData = dailyPostsMap.get(date)!;
            dailyData.count += 1;
            dailyData.lastPostTime = post.createdAt; // Update last post time to the latest post in the day
          } else {
            dailyPostsMap.set(date, {
              count: 1,
              lastPostTime: post.createdAt,
            });
          }
        });
        const dailyPosts = Array.from(dailyPostsMap.values());

        const maxComments = Math.max(
          ...dailyPosts.map((dp) => Number(dp.count)),
          0 // Ensure maxComments is at least 0 if there are no posts
        );

        dailyPosts.forEach((dailyPost) => {
          const timestamp = new Date(dailyPost.lastPostTime);
          events.push({
            type: TimelineEventType.CommentsVolume,
            timestamp,
            volume: Number(dailyPost.count),
            maxVolume: maxComments,
            volumeType: 'comments',
          });
        });
      }

      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (
        events[0] &&
        (events[0].type === TimelineEventType.CommentsVolume ||
          events[0].type === TimelineEventType.VotesVolume)
      ) {
        const currentTimestamp = new Date();
        let summaryContent = '';
        if (posts.length > 0 && allVotes.length > 0) {
          summaryContent = `${posts.length} comments and ${allVotes.length} votes`;
        } else if (posts.length > 0) {
          summaryContent = `${posts.length} comments`;
        } else if (allVotes.length > 0) {
          summaryContent = `${allVotes.length} votes`;
        } else {
          summaryContent = 'No activity';
        }
        events.unshift({
          content: summaryContent,
          type: TimelineEventType.Basic,
          timestamp: currentTimestamp,
          url: '',
        });
      }

      return {
        votes: processedVotes,
        posts,
        events,
      };
    } catch (error) {
      console.error('Error fetching feed:', error);
      return { votes: [], posts: [], events: [] };
    }
  });
}

export const getGroup_cached = unstable_cache(
  async (daoSlug: string, groupId: string) => {
    return await getGroup(daoSlug, groupId);
  },
  ['get-group'],
  { revalidate: 60 * 5, tags: ['get-group'] }
);

export const getBodies_cached = unstable_cache(
  async (groupId: string) => {
    return await getBodies(groupId);
  },
  ['get-bodies'],
  { revalidate: 60 * 5, tags: ['get-bodies'] }
);

export const getTotalVersions_cached = unstable_cache(
  async (groupId: string) => {
    return await getTotalVersions(groupId);
  },
  ['get-total-versions'],
  { revalidate: 60 * 5, tags: ['get-total-versions'] }
);

// export const getFeed_cached = superjson_cache(
//   async (
//     groupId: string,
//     feedFilter: FeedFilterEnum,
//     votesFilter: VotesFilterEnum
//   ) => {
//     return await getFeed(groupId, feedFilter, votesFilter);
//   },
//   ['get-feed-for-group'],
//   { revalidate: 60 * 5, tags: ['get-feed-for-group'] }
// );

export type GroupReturnType = AsyncReturnType<typeof getGroup>;
export type BodiesReturnType = AsyncReturnType<typeof getBodies>;
export type FeedReturnType = AsyncReturnType<typeof getFeed>;
