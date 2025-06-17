import {
  sql,
  type Selectable,
  type DB,
  type DiscourseTopic,
  type DiscourseUser,
  type Kysely,
} from '@proposalsapp/db';
import type { IDiscourseRepository } from '../types/repositories';

export class DiscourseRepository implements IDiscourseRepository {
  constructor(private db: Kysely<DB>) {}

  async getNewTopics(
    timeFrameInMinutes: number,
    daoDiscourseId: string,
    allowedCategoryIds?: number[]
  ): Promise<
    Array<
      Selectable<DiscourseTopic> & { discourseUser: Selectable<DiscourseUser> }
    >
  > {
    const result = await this.db
      .selectFrom('discourseTopic')
      .innerJoin(
        'discoursePost',
        'discoursePost.topicId',
        'discourseTopic.externalId'
      )
      .innerJoin(
        'discourseUser',
        'discourseUser.externalId',
        'discoursePost.userId'
      )
      .selectAll('discourseTopic')
      .select([
        'discourseUser.id as discourseUser.id',
        'discourseUser.externalId as discourseUser.externalId',
        'discourseUser.username as discourseUser.username',
        'discourseUser.name as discourseUser.name',
        'discourseUser.avatarTemplate as discourseUser.avatarTemplate',
        'discourseUser.daoDiscourseId as discourseUser.daoDiscourseId',
        'discourseUser.title as discourseUser.title',
        'discourseUser.likesGiven as discourseUser.likesGiven',
        'discourseUser.likesReceived as discourseUser.likesReceived',
        'discourseUser.daysVisited as discourseUser.daysVisited',
        'discourseUser.postsRead as discourseUser.postsRead',
        'discourseUser.topicsEntered as discourseUser.topicsEntered',
        'discourseUser.postCount as discourseUser.postCount',
        'discourseUser.topicCount as discourseUser.topicCount',
      ])
      .where('discourseTopic.daoDiscourseId', '=', daoDiscourseId)
      .where('discoursePost.daoDiscourseId', '=', daoDiscourseId)
      .where('discourseUser.daoDiscourseId', '=', daoDiscourseId)
      .where('discoursePost.postNumber', '=', 1)
      .where(
        'discourseTopic.createdAt',
        '>=',
        sql<Date>`NOW() - INTERVAL '${sql.literal(timeFrameInMinutes)} MINUTES'`
      )
      .where('discourseTopic.visible', '=', true)
      .where('discoursePost.deleted', '=', false)
      .$if(
        allowedCategoryIds !== undefined && allowedCategoryIds.length > 0,
        (qb) => qb.where('discourseTopic.categoryId', 'in', allowedCategoryIds!)
      )
      .execute();

    // Transform the flat result into nested structure
    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      externalId: row.externalId as number,
      title: row.title as string,
      slug: row.slug as string,
      fancyTitle: row.fancyTitle as string,
      categoryId: row.categoryId as number,
      daoDiscourseId: row.daoDiscourseId as string,
      archived: row.archived as boolean,
      closed: row.closed as boolean,
      pinned: row.pinned as boolean,
      pinnedGlobally: row.pinnedGlobally as boolean,
      visible: row.visible as boolean,
      postsCount: row.postsCount as number,
      replyCount: row.replyCount as number,
      likeCount: row.likeCount as number,
      views: row.views as number,
      createdAt: row.createdAt as Date,
      bumpedAt: row.bumpedAt as Date,
      lastPostedAt: row.lastPostedAt as Date,
      discourseUser: {
        id: row['discourseUser.id'] as string,
        externalId: row['discourseUser.externalId'] as number,
        username: row['discourseUser.username'] as string,
        name: row['discourseUser.name'] as string | null,
        avatarTemplate: row['discourseUser.avatarTemplate'] as string,
        daoDiscourseId: row['discourseUser.daoDiscourseId'] as string,
        title: row['discourseUser.title'] as string | null,
        likesGiven: row['discourseUser.likesGiven'] as string | null,
        likesReceived: row['discourseUser.likesReceived'] as string | null,
        daysVisited: row['discourseUser.daysVisited'] as string | null,
        postsRead: row['discourseUser.postsRead'] as string | null,
        topicsEntered: row['discourseUser.topicsEntered'] as string | null,
        postCount: row['discourseUser.postCount'] as string | null,
        topicCount: row['discourseUser.topicCount'] as string | null,
      },
    }));
  }
}
