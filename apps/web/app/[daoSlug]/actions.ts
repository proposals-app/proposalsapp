'use server';

import { cookies } from 'next/headers';
import { otel } from '@/lib/otel';
import { AsyncReturnType } from '@/lib/utils';
import {
  db,
  DiscourseTopic,
  Proposal,
  Selectable,
} from '@proposalsapp/db-indexer';
import { ProposalGroupItem } from '@/lib/types';

const COOKIE_PREFIX = 'group_last_seen_';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function getGroupLastSeenTimestamp(
  groupId: string
): Promise<number> {
  const cookieStore = await cookies();
  const timestamp = cookieStore.get(`${COOKIE_PREFIX}${groupId}`)?.value;
  return timestamp ? parseInt(timestamp, 10) : 0;
}

export async function initializeGroupCookie(
  groupId: string,
  timestamp: number
) {
  'use server';
  const cookieStore = await cookies();
  const existingTimestamp = cookieStore.get(`${COOKIE_PREFIX}${groupId}`);
  if (!existingTimestamp) {
    cookieStore.set(`${COOKIE_PREFIX}${groupId}`, timestamp.toString(), {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return getGroupLastSeenTimestamp(groupId);
}

export async function setGroupLastSeenTimestamp(
  groupId: string,
  timestamp: number
) {
  const cookieStore = await cookies();
  cookieStore.set(`${COOKIE_PREFIX}${groupId}`, timestamp.toString(), {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function updateLastSeenTimestampAction(
  groupId: string,
  timestamp: number
) {
  'use server';
  const cookieStore = await cookies();
  cookieStore.set(`${COOKIE_PREFIX}${groupId}`, timestamp.toString(), {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return timestamp;
}

export async function getGroups(daoSlug: string) {
  return otel('get-groups', async () => {
    // Fetch the DAO based on the slug
    const dao = await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();

    if (!dao) return null;

    const daoDiscourse = await db
      .selectFrom('daoDiscourse')
      .where('daoId', '=', dao.id)
      .selectAll()
      .executeTakeFirstOrThrow();

    // First, fetch all groups for the DAO
    const allGroups = await db
      .selectFrom('proposalGroup')
      .selectAll()
      .where('daoId', '=', dao.id)
      .execute();

    const getGroupTimestamps = async (
      group: (typeof allGroups)[0]
    ): Promise<{
      newestItemTimestamp: number;
      newestPostTimestamp: number;
      newestVoteTimestamp: number;
    }> => {
      return otel('get-group-timestamps', async () => {
        const items = group.items as ProposalGroupItem[];

        const proposals: Selectable<Proposal>[] = [];
        const proposalItems = items.filter((item) => item.type === 'proposal');
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
        const proposalIds = proposals.map((p) => p.id);

        const topics: Selectable<DiscourseTopic>[] = [];
        const topicItems = items.filter((item) => item.type === 'topic');
        if (topicItems.length > 0) {
          for (const topicItem of topicItems) {
            try {
              const t = await db
                .selectFrom('discourseTopic')
                .selectAll()
                .where('externalId', '=', parseInt(topicItem.externalId, 10))
                .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
                .executeTakeFirstOrThrow();
              topics.push(t);
            } catch (error) {
              console.error('Error fetching:', topicItem, error);
            }
          }
        }
        const topicIds = topics.map((t) => t.id);

        const [latestProposal, latestTopic, latestPost, latestVote] =
          await Promise.all([
            // Get latest proposal
            proposalIds.length > 0
              ? db
                  .selectFrom('proposal')
                  .select('createdAt')
                  .where('id', 'in', proposalIds)
                  .where('daoId', '=', dao.id)
                  .orderBy('createdAt', 'desc')
                  .limit(1)
                  .executeTakeFirst()
              : Promise.resolve(null),

            // Get latest topic
            topicIds.length > 0
              ? db
                  .selectFrom('discourseTopic')
                  .select('createdAt')
                  .where('id', 'in', topicIds)
                  .where('daoDiscourseId', '=', daoDiscourse.id)
                  .orderBy('createdAt', 'desc')
                  .limit(1)
                  .executeTakeFirst()
              : Promise.resolve(null),

            // Get latest post from all topics
            topicIds.length > 0
              ? db
                  .selectFrom('discoursePost')
                  .select('createdAt')
                  .where('daoDiscourseId', '=', daoDiscourse.id)
                  .where(
                    'topicId',
                    'in',
                    db
                      .selectFrom('discourseTopic')
                      .select('externalId')
                      .where('id', 'in', topicIds)
                      .where('daoDiscourseId', '=', daoDiscourse.id)
                  )
                  .orderBy('createdAt', 'desc')
                  .limit(1)
                  .executeTakeFirst()
              : Promise.resolve(null),

            // Get latest vote from all proposals
            proposalIds.length > 0
              ? db
                  .selectFrom('vote')
                  .select('createdAt')
                  .where('proposalId', 'in', proposalIds)
                  .where('daoId', '=', dao.id)
                  .where('votingPower', '>=', 5000000)
                  .orderBy('createdAt', 'desc')
                  .limit(1)
                  .executeTakeFirst()
              : Promise.resolve(null),
          ]);

        return {
          newestItemTimestamp: Math.max(
            latestProposal?.createdAt
              ? new Date(latestProposal.createdAt).getTime()
              : 0,
            latestTopic?.createdAt
              ? new Date(latestTopic.createdAt).getTime()
              : 0
          ),
          newestPostTimestamp: latestPost?.createdAt
            ? new Date(latestPost.createdAt).getTime()
            : 0,
          newestVoteTimestamp: latestVote?.createdAt
            ? new Date(latestVote.createdAt).getTime()
            : 0,
        };
      });
    };

    // Add timestamps to all groups
    const groupsWithTimestamps = await Promise.all(
      allGroups.map(async (group) => {
        const timestamps = await getGroupTimestamps(group);
        return {
          ...group,
          ...timestamps,
          // Add a new field that tracks the newest timestamp across all activities
          newestActivityTimestamp: Math.max(
            timestamps.newestItemTimestamp,
            timestamps.newestPostTimestamp,
            timestamps.newestVoteTimestamp
          ),
        };
      })
    );

    // Sort all groups by their newest activity timestamp
    groupsWithTimestamps.sort(
      (a, b) => b.newestActivityTimestamp - a.newestActivityTimestamp
    );

    return {
      daoName: dao.name,
      groups: groupsWithTimestamps,
    };
  });
}

export type GroupsReturnType = AsyncReturnType<typeof getGroups>;

interface AuthorInfo {
  originalAuthorName: string;
  originalAuthorPicture: string;
  createdAt: Date;
}

export async function getGroupAuthor(groupId: string): Promise<{
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
}> {
  'use server';
  return otel('get-group-author', async () => {
    const group = await db
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

    const proposals: Selectable<Proposal>[] = [];
    const proposalItems = items.filter((item) => item.type === 'proposal');
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
    const topicItems = items.filter((item) => item.type === 'topic');
    if (topicItems.length > 0) {
      for (const topicItem of topicItems) {
        try {
          const t = await db
            .selectFrom('discourseTopic')
            .selectAll()
            .where('externalId', '=', parseInt(topicItem.externalId, 10))
            .where('daoDiscourseId', '=', topicItem.daoDiscourseId)
            .executeTakeFirstOrThrow();
          topics.push(t);
        } catch (error) {
          console.error('Error fetching:', topicItem, error);
        }
      }
    }

    // Helper function to fetch topic and its author info
    const getTopicAuthorInfo = async (
      topic: Selectable<DiscourseTopic>
    ): Promise<AuthorInfo | null> => {
      try {
        const discourseFirstPost = await db
          .selectFrom('discoursePost')
          .where('discoursePost.topicId', '=', topic.externalId)
          .where('daoDiscourseId', '=', topic.daoDiscourseId)
          .where('discoursePost.postNumber', '=', 1)
          .selectAll()
          .executeTakeFirstOrThrow();

        const discourseFirstPostAuthor = await db
          .selectFrom('discourseUser')
          .where('discourseUser.externalId', '=', discourseFirstPost.userId)
          .where('daoDiscourseId', '=', topic.daoDiscourseId)
          .selectAll()
          .executeTakeFirstOrThrow();

        return {
          originalAuthorName:
            discourseFirstPostAuthor.name?.trim() ||
            discourseFirstPostAuthor.username ||
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
  });
}
