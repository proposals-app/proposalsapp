import {
  sql,
  type Selectable,
  type DB,
  type UserNotification,
  type Kysely,
} from '@proposalsapp/db';
import type { IUserNotificationRepository } from '../types/repositories';

export class UserNotificationRepository implements IUserNotificationRepository {
  constructor(private db: Kysely<DB>) {}

  async getRecentNotifications(
    userId: string,
    targetId: string,
    type: string,
    hoursSince: number
  ): Promise<Selectable<UserNotification>[]> {
    const result = await this.db
      .selectFrom('userNotification')
      .selectAll()
      .where('userId', '=', userId)
      .where('targetId', '=', targetId)
      .where('type', '=', type)
      .where(
        'sentAt',
        '>=',
        sql<Date>`NOW() - INTERVAL '${sql.literal(hoursSince)} HOURS'`
      )
      .execute();

    return result;
  }

  async createNotification(
    userId: string,
    targetId: string,
    type: string
  ): Promise<void> {
    await this.db
      .insertInto('userNotification')
      .values({
        userId,
        targetId,
        type,
      })
      .execute();
  }
}
