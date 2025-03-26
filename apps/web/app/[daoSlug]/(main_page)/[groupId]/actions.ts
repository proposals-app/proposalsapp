'use server';

import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import {
  ProcessedResults,
  ProcessedVote,
  processResultsAction,
} from '@/lib/results_processing';
import {
  FeedEvent,
  ProposalGroupItem,
  TimelineEventType,
  VoteSegmentData,
} from '@/lib/types';
import { AsyncReturnType } from '@/lib/utils';
import {
  dbIndexer,
  DiscoursePost,
  DiscourseTopic,
  Proposal,
  ProposalGroup,
  Selectable,
  Vote,
} from '@proposalsapp/db-indexer';
import { validate } from 'uuid';
import { getDelegateByDiscourseUser } from './components/feed/actions';
import { format } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';
import { ProposalMetadata } from '@/app/types';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { dbWeb } from '@proposalsapp/db-web';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';
import { daoSlugSchema, groupIdSchema } from '@/lib/validations';
import { revalidateTag } from 'next/cache';

export async function updateLastReadAt(groupId: string) {
  groupIdSchema.parse(groupId);

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  if (!userId) {
    return;
  }

  revalidateTag(`groups-${userId}`);

  const now = new Date();

  await dbWeb
    .insertInto('userProposalGroupLastRead')
    .values({
      userId: userId,
      proposalGroupId: groupId,
      lastReadAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['userId', 'proposalGroupId']).doUpdateSet({ lastReadAt: now })
    )
    .execute();
}

export async function getGroup(daoSlug: string, groupId: string) {
  'use cache';
  cacheLife('hours');

  daoSlugSchema.parse(daoSlug);
  groupIdSchema.parse(groupId);

  if (daoSlug == 'favicon.ico') return null;

  // Fetch the DAO based on the slug
  const dao = await dbIndexer
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
        (await dbIndexer
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
          const p = await dbIndexer
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
          const t = await dbIndexer
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
}

export type BodyVersionType = {
  title: string;
  content: string;
  author_name: string;
  author_picture: string;
  createdAt: Date;
  type: VersionType;
};

export type VersionType = 'topic' | 'onchain' | 'offchain';

export async function getBodyVersions(groupId: string, withContent: boolean) {
  'use cache';
  cacheLife('minutes');

  groupIdSchema.parse(groupId);

  const bodies: BodyVersionType[] = [];

  const group = await dbIndexer
    .selectFrom('proposalGroup')
    .selectAll()
    .where('id', '=', groupId)
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
        const p = await dbIndexer
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
      content: withContent ? proposal.body : '', // Conditionally include content
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
        const t = await dbIndexer
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
    const discourseFirstPost = await dbIndexer
      .selectFrom('discoursePost')
      .where('discoursePost.topicId', '=', discourseTopic.externalId)
      .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
      .where('discoursePost.postNumber', '=', 1)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseFirstPostAuthor = await dbIndexer
      .selectFrom('discourseUser')
      .where('discourseUser.externalId', '=', discourseFirstPost.userId)
      .where('daoDiscourseId', '=', discourseTopic.daoDiscourseId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const discourseFirstPostRevisions = await dbIndexer
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
        content: withContent ? (discourseFirstPost.cooked ?? 'Unknown') : '', // Conditionally include content
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
          content: withContent
            ? (discourseFirstPostRevision.cookedBodyBefore ??
              discourseFirstPost.cooked ??
              'Unknown')
            : '', // Conditionally include content
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
        content: withContent
          ? (discourseFirstPostRevision.cookedBodyAfter ??
            discourseFirstPost.cooked ??
            'Unknown')
          : '', // Conditionally include content
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
}

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

  // Initialize voteSegments and aggregatedVotes for each choice
  choices.forEach((_, index) => {
    voteSegments[index.toString()] = [];
    aggregatedVotes[index] = { count: 0, power: 0 };
  });

  // Process each vote and distribute its voting power according to the choices
  sortedVotes.forEach((vote) => {
    // Each vote can have multiple choices now
    vote.choice.forEach((choiceItem) => {
      const choiceIndex = choiceItem.choiceIndex;

      // Ensure the choice is a valid index in the choices array
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        // Calculate the proportional voting power based on the weight
        const proportionalVotingPower =
          (vote.votingPower * choiceItem.weight) / 100;
        const percentage = (proportionalVotingPower / totalVotingPower) * 100;

        if (percentage >= MIN_VISIBLE_WIDTH_PERCENT) {
          voteSegments[choiceIndex.toString()].push({
            votingPower: proportionalVotingPower,
          });
        } else {
          aggregatedVotes[choiceIndex].count += 1;
          aggregatedVotes[choiceIndex].power += proportionalVotingPower;
        }
      } else {
        console.warn(
          `Invalid choice index: ${choiceIndex}. Skipping this choice.`
        );
      }
    });
  });

  // Process aggregated votes
  Object.entries(aggregatedVotes).forEach(([choice, data]) => {
    if (data.power > 0) {
      voteSegments[choice].push({
        votingPower: data.power,
        isAggregated: true,
      });
    }
  });

  return voteSegments;
}

async function getAuthor(groupId: string) {
  'use cache';
  cacheLife('hours');

  groupIdSchema.parse(groupId);

  const group = await dbIndexer
    .selectFrom('proposalGroup')
    .selectAll()
    .where('id', '=', groupId)
    .executeTakeFirstOrThrow();

  const items = group.items as ProposalGroupItem[];
  const proposalItems: { externalId: string; governorId: string }[] = [];
  const topicItems: { externalId: string; daoDiscourseId: string }[] = [];

  items.forEach((item) => {
    if (item.type === 'proposal') {
      proposalItems.push({
        externalId: item.externalId,
        governorId: item.governorId,
      });
    } else if (item.type === 'topic') {
      topicItems.push({
        externalId: item.externalId,
        daoDiscourseId: item.daoDiscourseId,
      });
    }
  });

  const proposals =
    proposalItems.length > 0
      ? await dbIndexer
          .selectFrom('proposal')
          .selectAll()
          .where((eb) =>
            eb.or(
              proposalItems.map((item) =>
                eb('externalId', '=', item.externalId).and(
                  'governorId',
                  '=',
                  item.governorId
                )
              )
            )
          )
          .execute()
      : [];

  const topics =
    topicItems.length > 0
      ? await dbIndexer
          .selectFrom('discourseTopic')
          .selectAll()
          .where((eb) =>
            eb.or(
              topicItems.map((item) =>
                eb('externalId', '=', parseInt(item.externalId, 10)).and(
                  'daoDiscourseId',
                  '=',
                  item.daoDiscourseId
                )
              )
            )
          )
          .execute()
      : [];

  // Sort items by creation date to find the first one
  const sortedItems = [...proposals, ...topics].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (sortedItems.length === 0) return null;

  const firstItem = sortedItems[0];

  // Get the DAO to lookup any delegates
  const dao = await dbIndexer
    .selectFrom('dao')
    .selectAll()
    .where('id', '=', group.daoId)
    .executeTakeFirst();

  if (!dao) return null;

  let delegate = null;

  // If the first item is a proposal, get the voter/delegate
  if ('governorId' in firstItem) {
    const voter = await dbIndexer
      .selectFrom('voter')
      .selectAll()
      .where('address', '=', firstItem.author)
      .executeTakeFirst();

    if (voter) {
      // Find delegate associated with this voter
      const delegateToVoter = await dbIndexer
        .selectFrom('delegateToVoter')
        .innerJoin('delegate', 'delegate.id', 'delegateToVoter.delegateId')
        .where('delegateToVoter.voterId', '=', voter.id)
        .where('delegate.daoId', '=', dao.id)
        .where('delegateToVoter.periodEnd', '>=', new Date())
        .select([
          'delegate.id as delegateId',
          'delegateToVoter.id as relationId',
        ])
        .executeTakeFirst();

      if (delegateToVoter) {
        delegate = await dbIndexer
          .selectFrom('delegate')
          .where('id', '=', delegateToVoter.delegateId)
          .selectAll()
          .executeTakeFirst();
      }
    }
  }
  // If the first item is a topic, get the discourse user/delegate
  else if ('daoDiscourseId' in firstItem) {
    // Get the first post of the topic
    const firstPost = await dbIndexer
      .selectFrom('discoursePost')
      .where('topicId', '=', firstItem.externalId)
      .where('daoDiscourseId', '=', firstItem.daoDiscourseId)
      .where('postNumber', '=', 1)
      .selectAll()
      .executeTakeFirst();

    if (firstPost) {
      // Get the discourse user who authored the first post
      const discourseUser = await dbIndexer
        .selectFrom('discourseUser')
        .where('externalId', '=', firstPost.userId)
        .where('daoDiscourseId', '=', firstItem.daoDiscourseId)
        .selectAll()
        .executeTakeFirst();

      if (discourseUser) {
        // Find delegate associated with this discourse user
        const delegateToDiscourseUser = await dbIndexer
          .selectFrom('delegateToDiscourseUser')
          .innerJoin(
            'delegate',
            'delegate.id',
            'delegateToDiscourseUser.delegateId'
          )
          .where(
            'delegateToDiscourseUser.discourseUserId',
            '=',
            discourseUser.id
          )
          .where('delegate.daoId', '=', dao.id)
          .select([
            'delegate.id as delegateId',
            'delegateToDiscourseUser.id as relationId',
          ])
          .executeTakeFirst();

        if (delegateToDiscourseUser) {
          delegate = await dbIndexer
            .selectFrom('delegate')
            .where('id', '=', delegateToDiscourseUser.delegateId)
            .selectAll()
            .executeTakeFirst();
        }
      }
    }
  }

  // If we found a delegate, fetch all related information
  if (delegate) {
    // Get all delegate to voter relationships
    const delegateToVoters = await dbIndexer
      .selectFrom('delegateToVoter')
      .innerJoin('voter', 'voter.id', 'delegateToVoter.voterId')
      .leftJoin('votingPower', (join) =>
        join
          .on('votingPower.voter', '=', 'voter.address')
          .on('votingPower.daoId', '=', dao.id)
      )
      .where('delegateToVoter.delegateId', '=', delegate.id)
      .select([
        'delegateToVoter.id',
        'voter.address',
        'voter.ens',
        'voter.avatar',
        'votingPower.votingPower',
        'votingPower.timestamp',
      ])
      .execute();

    // Get all delegate to discourse user relationships
    const delegateToDiscourseUsers = await dbIndexer
      .selectFrom('delegateToDiscourseUser')
      .innerJoin(
        'discourseUser',
        'discourseUser.id',
        'delegateToDiscourseUser.discourseUserId'
      )
      .where('delegateToDiscourseUser.delegateId', '=', delegate.id)
      .select([
        'delegateToDiscourseUser.id',
        'discourseUser.username',
        'discourseUser.name',
        'discourseUser.avatarTemplate',
        'discourseUser.externalId',
      ])
      .execute();

    // Return delegate with all relationships
    return {
      delegate,
      voters: delegateToVoters,
      discourseUsers: delegateToDiscourseUsers,
    };
  }

  return null;
}

export async function getFeed(
  groupId: string,
  feedFilter: FeedFilterEnum,
  fromFilter: FromFilterEnum,
  resultsOnly: boolean = false
): Promise<{
  votes: ProcessedVote[];
  posts: Selectable<DiscoursePost>[];
  events: FeedEvent[];
}> {
  'use cache';
  cacheLife('minutes');

  groupIdSchema.parse(groupId);

  let author = null;

  if (fromFilter === FromFilterEnum.AUTHOR) author = await getAuthor(groupId);

  // Fetch the proposal group
  const group = await dbIndexer
    .selectFrom('proposalGroup')
    .selectAll()
    .where('id', '=', groupId)
    .executeTakeFirstOrThrow();

  const dao = await dbIndexer
    .selectFrom('dao')
    .selectAll()
    .where('dao.id', '=', group.daoId)
    .executeTakeFirstOrThrow();

  const daoDiscourse = await dbIndexer
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', group.daoId)
    .executeTakeFirstOrThrow();

  if (!group) {
    return { votes: [], posts: [], events: [] };
  }

  let allPosts: Selectable<DiscoursePost>[] = [];
  let posts: Selectable<DiscoursePost>[] = [];
  let processedVotes: ProcessedVote[] = [];

  const allVotes: Selectable<Vote>[] = [];
  const filteredProcessedVotes: ProcessedVote[] = [];

  let events: FeedEvent[] = [];

  // Extract proposal and topic IDs from group items
  const items = group.items as ProposalGroupItem[];

  const proposalItems = items.filter((item) => item.type === 'proposal');
  const topicItems = items.filter((item) => item.type === 'topic');

  const proposals: Selectable<Proposal>[] = [];
  const topics: Selectable<DiscourseTopic>[] = [];

  if (proposalItems.length > 0) {
    for (const proposalItem of proposalItems) {
      try {
        const proposal = await dbIndexer
          .selectFrom('proposal')
          .selectAll()
          .where('externalId', '=', proposalItem.externalId)
          .where('governorId', '=', proposalItem.governorId)
          .executeTakeFirstOrThrow();

        const allVotesForProposal = await dbIndexer
          .selectFrom('vote')
          .selectAll()
          .where('proposalId', '=', proposal.id)
          .execute();

        const filteredVotesForTimeline = allVotesForProposal.filter((vote) => {
          if (fromFilter === FromFilterEnum.FIFTY_THOUSAND) {
            return vote.votingPower > 50000;
          } else if (fromFilter === FromFilterEnum.FIVE_HUNDRED_THOUSAND) {
            return vote.votingPower > 500000;
          } else if (fromFilter === FromFilterEnum.FIVE_MILLION) {
            return vote.votingPower > 5000000;
          } else if (fromFilter === FromFilterEnum.ALL) {
            return true;
          } else if (fromFilter == FromFilterEnum.AUTHOR) {
            return author?.voters
              .map((av) => av.address)
              .includes(vote.voterAddress);
          }
          return true;
        });

        proposals.push(proposal);
        allVotes.push(...allVotesForProposal);

        const filteredProcessedResults = await processResultsAction(
          proposal,
          filteredVotesForTimeline,
          {
            withVotes: true,
            withTimeseries: false,
            aggregatedVotes: true,
          }
        );

        const dailyFilteredVotesMap = new Map<
          string,
          {
            totalVotingPower: number;
            lastVoteTime: Date;
            choiceVotingPower: { [choice: number]: number };
          }
        >();

        if (filteredProcessedResults.votes) {
          filteredProcessedVotes.push(...filteredProcessedResults.votes);
          filteredProcessedResults.votes.forEach((vote) => {
            // Get the date in locale format to use as key
            const date = vote.createdAt.toLocaleDateString();
            const votingPower = vote.votingPower;

            if (dailyFilteredVotesMap.has(date)) {
              const dailyData = dailyFilteredVotesMap.get(date)!;
              dailyData.totalVotingPower += votingPower;
              dailyData.lastVoteTime = vote.createdAt; // Update last vote time to the latest vote in the day

              // Add voting power to each choice based on weight
              vote.choice.forEach((choiceItem) => {
                const choiceIndex = choiceItem.choiceIndex;
                const proportionalVotingPower =
                  (votingPower * choiceItem.weight) / 100;

                if (!dailyData.choiceVotingPower[choiceIndex]) {
                  dailyData.choiceVotingPower[choiceIndex] = 0;
                }
                dailyData.choiceVotingPower[choiceIndex] +=
                  proportionalVotingPower;
              });
            } else {
              // Initialize a new entry
              const choiceVotingPower: { [choice: number]: number } = {};

              // Initialize voting power for each choice
              vote.choice.forEach((choiceItem) => {
                const choiceIndex = choiceItem.choiceIndex;
                const proportionalVotingPower =
                  (votingPower * choiceItem.weight) / 100;
                choiceVotingPower[choiceIndex] = proportionalVotingPower;
              });

              dailyFilteredVotesMap.set(date, {
                totalVotingPower: votingPower,
                lastVoteTime: vote.createdAt,
                choiceVotingPower,
              });
            }
          });
        }

        const dailyFilteredVotes = Array.from(dailyFilteredVotesMap.values());

        const maxVotes = Math.max(
          ...dailyFilteredVotes.map((dv) => Number(dv.totalVotingPower)),
          0 // Ensure maxVotes is at least 0 if there are no votes
        );

        // Create volumes entry from the daily votes
        dailyFilteredVotes.forEach((dailyVote) => {
          const dailyVotingPower = Number(dailyVote.totalVotingPower);
          const timestamp = new Date(dailyVote.lastVoteTime);

          // Get choices from the proposal
          const choices = proposal.choices as string[];

          // Initialize volumes array with one element per choice, all set to 0
          const volumes: number[] = Array(choices.length).fill(0);
          const colors: string[] = [];

          // Fill the volumes array with voting power by choice
          Object.entries(dailyVote.choiceVotingPower).forEach(
            ([choiceIndex, votingPower]) => {
              const index = parseInt(choiceIndex);
              if (index >= 0 && index < volumes.length) {
                volumes[index] = votingPower;
              }
            }
          );

          colors.push(...filteredProcessedResults.choiceColors);

          events.push({
            type: TimelineEventType.VotesVolume,
            timestamp,
            volumes: volumes,
            colors: colors,
            maxVolume: maxVotes,
            volumeType: 'votes',
            metadata: {
              votingPower: dailyVotingPower,
            },
          });
        });
        const startedAt = new Date(proposal.startAt);
        const endedAt = new Date(proposal.endAt);

        const daoGovernor = await dbIndexer
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
          type: offchain
            ? TimelineEventType.Offchain
            : TimelineEventType.Onchain,
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
              aggregatedVotes: true,
            }
          );

          if (
            processedResults.votes &&
            (feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES ||
              feedFilter == FeedFilterEnum.VOTES)
          ) {
            processedVotes.push(
              ...processedResults.votes.filter((vote) => {
                if (fromFilter === FromFilterEnum.FIFTY_THOUSAND) {
                  return vote.votingPower > 50000;
                } else if (
                  fromFilter === FromFilterEnum.FIVE_HUNDRED_THOUSAND
                ) {
                  return vote.votingPower > 500000;
                } else if (fromFilter === FromFilterEnum.FIVE_MILLION) {
                  return vote.votingPower > 5000000;
                } else if (fromFilter === FromFilterEnum.ALL) {
                  return true;
                } else if (fromFilter == FromFilterEnum.AUTHOR) {
                  return author?.voters
                    .map((av) => av.address)
                    .includes(vote.voterAddress);
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
        const t = await dbIndexer
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
    type: TimelineEventType.Discussion,
    timestamp: createdAt,
    url: `${daoDiscourse.discourseBaseUrl}/t/${topics[0].externalId}`,
  });

  if (topics.length > 0) {
    allPosts = await dbIndexer
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
      allPosts.map(async (post) => {
        const delegate = await getDelegateByDiscourseUser(
          post.userId,
          dao.slug,
          false,
          topics.map((t) => t.id.toString()),
          proposals.map((p) => p.id)
        );

        const authorVotingPower =
          delegate?.delegatetovoter?.latestVotingPower?.votingPower || 0;

        if (fromFilter === FromFilterEnum.ALL) {
          return post;
        } else if (
          fromFilter === FromFilterEnum.FIFTY_THOUSAND &&
          authorVotingPower > 50000
        ) {
          return post;
        } else if (
          fromFilter === FromFilterEnum.FIVE_HUNDRED_THOUSAND &&
          authorVotingPower > 500000
        ) {
          return post;
        } else if (
          fromFilter === FromFilterEnum.FIVE_MILLION &&
          authorVotingPower > 5000000
        ) {
          return post;
        } else if (fromFilter == FromFilterEnum.AUTHOR) {
          if (
            author?.discourseUsers
              .map((ad) => ad.username)
              .includes(post.username)
          ) {
            return post;
          }
        }
        return null;
      })
    );

    if (
      feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES ||
      feedFilter == FeedFilterEnum.COMMENTS
    )
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
    if (allPosts.length > 0 && allVotes.length > 0) {
      summaryContent = `${allPosts.length} comments and ${allVotes.length} votes`;
    } else if (allPosts.length > 0) {
      summaryContent = `${allPosts.length} comments`;
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

  if (resultsOnly) {
    posts = [];
    processedVotes = [];
    events = events.filter(
      (event) =>
        event.type === TimelineEventType.ResultOngoingBasicVote ||
        event.type === TimelineEventType.ResultOngoingOtherVotes ||
        event.type === TimelineEventType.ResultEndedBasicVote ||
        event.type === TimelineEventType.ResultEndedOtherVotes
    );
  }

  return {
    votes: processedVotes,
    posts,
    events,
  };
}

export async function getGroupHeader(groupId: string): Promise<{
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
}> {
  'use cache';
  cacheLife('hours');

  groupIdSchema.parse(groupId);

  interface AuthorInfo {
    originalAuthorName: string;
    originalAuthorPicture: string;
    createdAt: Date;
  }

  const group = await dbIndexer
    .selectFrom('proposalGroup')
    .where('id', '=', groupId)
    .selectAll()
    .executeTakeFirst();

  if (!group) {
    return {
      originalAuthorName: 'Unknown',
      originalAuthorPicture:
        'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
      groupName: 'Unknown Group',
    };
  }

  const items = group.items as ProposalGroupItem[];

  let authorInfo = {
    originalAuthorName: 'Unknown',
    originalAuthorPicture:
      'https://api.dicebear.com/9.x/pixel-art/png?seed=proposals.app',
  };

  // Extract all item IDs to fetch in bulk
  const proposalItems: { externalId: string; governorId: string }[] = [];
  const topicItems: { externalId: string; daoDiscourseId: string }[] = [];

  items.forEach((item) => {
    if (item.type === 'proposal') {
      proposalItems.push({
        externalId: item.externalId,
        governorId: item.governorId,
      });
    } else if (item.type === 'topic') {
      topicItems.push({
        externalId: item.externalId,
        daoDiscourseId: item.daoDiscourseId,
      });
    }
  });

  // Fetch proposals in bulk
  const proposals =
    proposalItems.length > 0
      ? await dbIndexer
          .selectFrom('proposal')
          .selectAll()
          .where((eb) =>
            eb.or(
              proposalItems.map((item) =>
                eb('externalId', '=', item.externalId).and(
                  'governorId',
                  '=',
                  item.governorId
                )
              )
            )
          )
          .execute()
      : [];

  // Fetch topics in bulk
  const topics =
    topicItems.length > 0
      ? await dbIndexer
          .selectFrom('discourseTopic')
          .selectAll()
          .where((eb) =>
            eb.or(
              topicItems.map((item) =>
                eb('externalId', '=', parseInt(item.externalId, 10)).and(
                  'daoDiscourseId',
                  '=',
                  item.daoDiscourseId
                )
              )
            )
          )
          .execute()
      : [];

  // Helper function to fetch topic and its author info
  const getTopicAuthorInfo = async (
    topic: Selectable<DiscourseTopic>
  ): Promise<AuthorInfo | null> => {
    try {
      const discourseFirstPost = await dbIndexer
        .selectFrom('discoursePost')
        .where('discoursePost.topicId', '=', topic.externalId)
        .where('daoDiscourseId', '=', topic.daoDiscourseId)
        .where('discoursePost.postNumber', '=', 1)
        .selectAll()
        .executeTakeFirstOrThrow();

      const discourseFirstPostAuthor = await dbIndexer
        .selectFrom('discourseUser')
        .where('discourseUser.externalId', '=', discourseFirstPost.userId)
        .where('daoDiscourseId', '=', topic.daoDiscourseId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        originalAuthorName:
          discourseFirstPostAuthor.username ||
          discourseFirstPostAuthor.name ||
          'Unknown',
        originalAuthorPicture: discourseFirstPostAuthor.avatarTemplate.length
          ? discourseFirstPostAuthor.avatarTemplate
          : `https://api.dicebear.com/9.x/pixel-art/png?seed=${discourseFirstPostAuthor.username}`,
        createdAt: topic.createdAt,
      };
    } catch (topicError) {
      console.error('Error fetching topic author data:', topicError);
      return null;
    }
  };

  // Helper function to fetch proposal and its author info
  const getProposalAuthorInfo = async (
    proposal: Selectable<Proposal>
  ): Promise<AuthorInfo | null> => {
    try {
      return {
        originalAuthorName: proposal.author || 'Unknown',
        originalAuthorPicture: `https://api.dicebear.com/9.x/pixel-art/png?seed=${proposal.author}`,
        createdAt: proposal.createdAt,
      };
    } catch (proposalError) {
      console.error('Error fetching proposal author data:', proposalError);
      return null;
    }
  };

  // Fetch all topics with their author info
  const topicsWithAuthors = await Promise.all(
    topics.map((topic) => getTopicAuthorInfo(topic))
  );

  // Fetch all proposals with their author info
  const proposalsWithAuthors = await Promise.all(
    proposals.map((proposal) => getProposalAuthorInfo(proposal))
  );

  // Combine topics and proposals, filter out null results, and sort by createdAt
  const allItemsWithAuthors = [...topicsWithAuthors, ...proposalsWithAuthors]
    .filter((item): item is NonNullable<AuthorInfo> => Boolean(item))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  // If there are any items with authors, use the first one
  if (allItemsWithAuthors.length > 0) {
    authorInfo = {
      originalAuthorName: allItemsWithAuthors[0].originalAuthorName,
      originalAuthorPicture: allItemsWithAuthors[0].originalAuthorPicture,
    };
  }

  return {
    ...authorInfo,
    groupName: group.name,
  };
}

export type GroupReturnType = AsyncReturnType<typeof getGroup>;
export type BodyVersionsReturnType = AsyncReturnType<typeof getBodyVersions>;
export type FeedReturnType = AsyncReturnType<typeof getFeed>;
